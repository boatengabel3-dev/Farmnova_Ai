import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  CROP_PROFILES,
  computeAndSaveIndicators,
  computeCropRotationPlan,
  computeSoilMoistureAndRiskOutlook,
  generateAndSaveRecommendation,
} from './server/agronomy.ts';
import {
  db,
  getAllFarms,
  getClimateBaseline,
  getDatasets,
  getFarmById,
  getIndicators,
  getIngestionRuns,
  getLatestRecommendation,
  getObservations,
  getProgressLogsForFarm,
  getSeasonsForFarm,
  initDatabase,
} from './server/db.ts';
import {
  getCachedMeteomaticsWeather,
  getIntegrationStatuses,
  invokeSupabaseEdgeSync,
  syncMeteomaticsWeatherForFarm,
} from './server/integrations.ts';
import {
  askAlphaAssistant,
  getLanguageCapabilities,
  normalizeLanguageCode,
  synthesizeSpeechAudio,
  transcribeFarmerAudio,
  translateTextsBatch,
  translateWithKhaya,
} from './server/language.ts';
import {
  getCachedLandsatScenes,
  getVerifiedGibsLayers,
  runSecondaryNasaDiscovery,
  seedDemoPowerObservationsIfEmpty,
  syncNasaClimatologyForFarm,
  syncNasaEonetEvents,
  syncNasaPowerForFarm,
} from './server/nasa.ts';
import { findNearestLocation, GLOBAL_LOCATIONS } from './server/regions.ts';
import type { CropId, FarmRecord, GeoJsonPolygon, GrowthStage, LanguageCode, PriorityId } from './server/types.ts';

initDatabase();

const demoFarm = getFarmById('demo-ejura-farm');
if (demoFarm) {
  seedDemoPowerObservationsIfEmpty(demoFarm.id);
  const existingInd = getIndicators(demoFarm.id);
  const ind = existingInd ?? computeAndSaveIndicators(demoFarm, 224);
  if (!getLatestRecommendation(demoFarm.id)) {
    generateAndSaveRecommendation(demoFarm, ind);
  }
}

const app = express();
app.use(express.json({ limit: '4mb' }));

function getFarmerId(req: express.Request): string {
  const raw = req.header('x-farmova-farmer-id');
  if (raw && /^[a-zA-Z0-9_-]{4,64}$/.test(raw)) return raw;
  return 'demo-farmer';
}

function canAccessFarm(farm: FarmRecord, farmerId: string): boolean {
  return farm.is_demo || farm.owner_id === farmerId || farmerId === 'expert-workspace';
}

function computePolygonAreaHectares(poly: GeoJsonPolygon | null): { hectares: number | null; acres: number | null } {
  if (!poly || poly.type !== 'Polygon' || !poly.coordinates?.[0] || poly.coordinates[0].length < 4) {
    return { hectares: null, acres: null };
  }
  const ring = poly.coordinates[0];
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    const p1 = (lon1 * Math.PI) / 180;
    const p2 = (lon2 * Math.PI) / 180;
    const f1 = (lat1 * Math.PI) / 180;
    const f2 = (lat2 * Math.PI) / 180;
    total += (p2 - p1) * (2 + Math.sin(f1) + Math.sin(f2));
  }
  const areaSqMeters = Math.abs((total * R * R) / 2);
  const hectares = Number((areaSqMeters / 10_000).toFixed(2));
  const acres = Number((hectares * 2.47105).toFixed(2));
  return { hectares, acres };
}

function validateCoordinates(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la, lon: lo };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Farmova AI Backend', timestamp: new Date().toISOString() });
});

app.get('/api/locations', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const results = q
    ? GLOBAL_LOCATIONS.filter(
        (l) =>
          l.community.toLowerCase().includes(q) ||
          l.district.toLowerCase().includes(q) ||
          l.region.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q)
      )
    : GLOBAL_LOCATIONS;
  res.json({ locations: results });
});

app.get('/api/gibs-layers', async (_req, res) => {
  const layers = await getVerifiedGibsLayers();
  res.json({ layers });
});

app.get('/api/datasets', (_req, res) => {
  res.json({ datasets: getDatasets() });
});

app.get('/api/integrations/status', (_req, res) => {
  res.json(getIntegrationStatuses());
});

app.get('/api/crops', (_req, res) => {
  res.json({ crops: Object.values(CROP_PROFILES) });
});

app.get('/api/language/capabilities', (_req, res) => {
  res.json(getLanguageCapabilities());
});

app.get('/api/farms', (req, res) => {
  const farmerId = getFarmerId(req);
  const workspace = req.query.scope === 'all';
  const farms = workspace ? getAllFarms() : getAllFarms(farmerId);
  const enriched = farms.map((f) => ({
    ...f,
    indicators: getIndicators(f.id),
    latestRecommendation: getLatestRecommendation(f.id),
  }));
  res.json({ farms: enriched });
});

app.post('/api/farms', async (req, res) => {
  try {
    const farmerId = getFarmerId(req);
    const body = req.body ?? {};
    const coords = validateCoordinates(body.latitude, body.longitude);
    if (!coords) {
      res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`INSERT OR IGNORE INTO users (id, name, preferred_language, role, created_at) VALUES (?, ?, ?, 'farmer', ?)`).run(
      farmerId,
      String(body.ownerName ?? 'Farmer').slice(0, 80),
      normalizeLanguageCode(body.language),
      now
    );

    const nearest = findNearestLocation(coords.lat, coords.lon);
    const community = String(body.community ?? nearest?.community ?? '').slice(0, 80);
    const district = String(body.district ?? nearest?.district ?? '').slice(0, 80);
    const region = String(body.region ?? nearest?.region ?? '').slice(0, 80);
    const country = String(body.country ?? nearest?.country ?? '').slice(0, 80);

    const boundary: GeoJsonPolygon | null =
      body.boundary_geojson?.type === 'Polygon' && Array.isArray(body.boundary_geojson.coordinates)
        ? body.boundary_geojson
        : null;
    const calcArea = computePolygonAreaHectares(boundary);
    const areaHectares = calcArea.hectares ?? (typeof body.area_hectares === 'number' ? Number(body.area_hectares) : null);
    const areaAcres = calcArea.acres ?? (typeof body.area_acres === 'number' ? Number(body.area_acres) : areaHectares ? Number((areaHectares * 2.47105).toFixed(2)) : null);

    const farmId = `farm-${crypto.randomUUID().slice(0, 8)}`;
    const defaultName = community ? `${community} Farm` : country ? `${country} Plot` : 'My Farm';
    const farmName = String(body.name ?? defaultName).trim().slice(0, 90) || defaultName;

    const validSources = new Set(['gps', 'manual', 'search', 'demo']);
    const locSource = validSources.has(body.location_source) ? body.location_source : 'manual';
    const priorities: PriorityId[] = Array.isArray(body.priorities) ? body.priorities.slice(0, 5) : [];

    db.prepare(`
      INSERT INTO farms (
        id, owner_id, name, latitude, longitude, gps_accuracy_m, gps_recorded_at,
        is_at_farm, location_source, location_confirmed, boundary_geojson,
        area_hectares, area_acres, community, district, region, country, size_category,
        previous_crop, intended_crop, priorities_json, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      farmId,
      farmerId,
      farmName,
      coords.lat,
      coords.lon,
      typeof body.gps_accuracy_m === 'number' ? body.gps_accuracy_m : null,
      body.gps_recorded_at ? String(body.gps_recorded_at) : null,
      body.is_at_farm === null || body.is_at_farm === undefined ? null : body.is_at_farm ? 1 : 0,
      locSource,
      body.location_confirmed ? 1 : 0,
      boundary ? JSON.stringify(boundary) : null,
      areaHectares,
      areaAcres,
      community,
      district,
      region,
      country,
      body.size_category ? String(body.size_category) : null,
      body.previous_crop ? String(body.previous_crop) : null,
      body.intended_crop ? String(body.intended_crop) : 'help_me_decide',
      JSON.stringify(priorities),
      now,
      now
    );

    if (body.previous_crop && body.previous_crop !== 'help_me_decide') {
      db.prepare(`INSERT INTO crop_history (id, farm_id, season_label, crop_id, notes, recorded_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
        crypto.randomUUID(),
        farmId,
        'Previous Season',
        String(body.previous_crop),
        'Recorded during farmer onboarding',
        now
      );
    }

    const farm = getFarmById(farmId)!;

    // Fetch real NASA POWER daily + 20-year climatology + EONET hazards + Meteomatics (if configured) in parallel
    const [powerResult, climatology, meteomatics] = await Promise.all([
      syncNasaPowerForFarm(farm),
      syncNasaClimatologyForFarm(farm),
      syncMeteomaticsWeatherForFarm(farm),
    ]);
    await syncNasaEonetEvents(farm.id).catch(() => []);
    const discovery = await runSecondaryNasaDiscovery(farm).catch(() => null);

    const indicators = computeAndSaveIndicators(farm, powerResult.elevationM);
    const recommendation = generateAndSaveRecommendation(farm, indicators);
    const observations = getObservations(farm.id, 'nasa-power');
    const outlook = computeSoilMoistureAndRiskOutlook(farm, indicators, observations, climatology);
    const rotationPlan = computeCropRotationPlan(farm, indicators, outlook, climatology);

    res.status(201).json({
      farm,
      indicators,
      recommendation,
      outlook,
      rotationPlan,
      climatology,
      meteomatics,
      landsatScenes: discovery?.landsatScenes ?? getCachedLandsatScenes(farm.id),
      nasaSync: powerResult,
    });
  } catch (err) {
    console.error('Error creating farm:', err);
    res.status(500).json({ error: 'Unable to register farm right now.' });
  }
});

app.patch('/api/farms/:id', (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const body = req.body ?? {};
  const now = new Date().toISOString();

  let lat = farm.latitude;
  let lon = farm.longitude;
  if (body.latitude !== undefined && body.longitude !== undefined) {
    const valid = validateCoordinates(body.latitude, body.longitude);
    if (!valid) {
      res.status(400).json({ error: 'Invalid coordinates.' });
      return;
    }
    lat = valid.lat;
    lon = valid.lon;
  }

  const boundary: GeoJsonPolygon | null =
    body.boundary_geojson === null
      ? null
      : body.boundary_geojson?.type === 'Polygon'
      ? body.boundary_geojson
      : farm.boundary_geojson;

  const calcArea = computePolygonAreaHectares(boundary);
  const areaHectares =
    calcArea.hectares ?? (typeof body.area_hectares === 'number' ? Number(body.area_hectares) : farm.area_hectares);
  const areaAcres =
    calcArea.acres ?? (typeof body.area_acres === 'number' ? Number(body.area_acres) : farm.area_acres);

  db.prepare(`
    UPDATE farms SET
      name = ?,
      latitude = ?,
      longitude = ?,
      location_confirmed = ?,
      boundary_geojson = ?,
      area_hectares = ?,
      area_acres = ?,
      community = ?,
      district = ?,
      region = ?,
      country = ?,
      size_category = ?,
      previous_crop = ?,
      intended_crop = ?,
      priorities_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    body.name ? String(body.name).slice(0, 90) : farm.name,
    lat,
    lon,
    body.location_confirmed !== undefined ? (body.location_confirmed ? 1 : 0) : farm.location_confirmed ? 1 : 0,
    boundary ? JSON.stringify(boundary) : null,
    areaHectares,
    areaAcres,
    body.community !== undefined ? String(body.community).slice(0, 80) : farm.community,
    body.district !== undefined ? String(body.district).slice(0, 80) : farm.district,
    body.region !== undefined ? String(body.region).slice(0, 80) : farm.region,
    body.country !== undefined ? String(body.country).slice(0, 80) : farm.country,
    body.size_category !== undefined ? (body.size_category ? String(body.size_category) : null) : farm.size_category,
    body.previous_crop !== undefined ? (body.previous_crop ? String(body.previous_crop) : null) : farm.previous_crop,
    body.intended_crop !== undefined ? (body.intended_crop ? String(body.intended_crop) : null) : farm.intended_crop,
    body.priorities !== undefined ? JSON.stringify(body.priorities) : JSON.stringify(farm.priorities),
    now,
    farm.id
  );

  const updated = getFarmById(farm.id)!;
  const indicators = getIndicators(updated.id) ?? computeAndSaveIndicators(updated);
  const recommendation = generateAndSaveRecommendation(updated, indicators);
  const outlook = computeSoilMoistureAndRiskOutlook(updated, indicators);
  res.json({ farm: updated, indicators, recommendation, outlook });
});

app.get('/api/farms/:id/intelligence', (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const indicators = getIndicators(farm.id) ?? computeAndSaveIndicators(farm);
  const recommendation = getLatestRecommendation(farm.id) ?? generateAndSaveRecommendation(farm, indicators);
  const observations = getObservations(farm.id, 'nasa-power');
  const climatology = getClimateBaseline(farm.id);
  const outlook = computeSoilMoistureAndRiskOutlook(farm, indicators, observations, climatology);
  const rotationPlan = computeCropRotationPlan(farm, indicators, outlook, climatology);
  const cropHistory = db
    .prepare('SELECT * FROM crop_history WHERE farm_id = ? ORDER BY recorded_at DESC')
    .all(farm.id);
  const ingestionRuns = getIngestionRuns(farm.id);
  const seasons = getSeasonsForFarm(farm.id);
  const progressLogs = getProgressLogsForFarm(farm.id);
  const meteomatics = getCachedMeteomaticsWeather(farm.id);
  const landsatScenes = getCachedLandsatScenes(farm.id);
  const integrations = getIntegrationStatuses();

  res.json({
    farm,
    indicators,
    recommendation,
    observations,
    climatology,
    outlook,
    rotationPlan,
    cropHistory,
    ingestionRuns,
    seasons,
    progressLogs,
    meteomatics,
    landsatScenes,
    integrations,
  });
});

app.post('/api/farms/:id/sync-nasa', async (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const [powerResult, climatology, meteomatics] = await Promise.all([
    syncNasaPowerForFarm(farm),
    syncNasaClimatologyForFarm(farm),
    syncMeteomaticsWeatherForFarm(farm),
  ]);
  await syncNasaEonetEvents(farm.id);
  const discovery = await runSecondaryNasaDiscovery(farm);

  const indicators = computeAndSaveIndicators(farm, powerResult.elevationM);
  const recommendation = generateAndSaveRecommendation(farm, indicators);
  const observations = getObservations(farm.id, 'nasa-power');
  const outlook = computeSoilMoistureAndRiskOutlook(farm, indicators, observations, climatology);
  const rotationPlan = computeCropRotationPlan(farm, indicators, outlook, climatology);
  const ingestionRuns = getIngestionRuns(farm.id);
  const seasons = getSeasonsForFarm(farm.id);

  res.json({
    nasaSync: powerResult,
    discovery,
    landsatScenes: discovery.landsatScenes,
    meteomatics,
    integrations: getIntegrationStatuses(),
    indicators,
    recommendation,
    observations,
    climatology,
    outlook,
    rotationPlan,
    ingestionRuns,
    seasons,
    datasets: getDatasets(),
  });
});

app.post('/api/farms/:id/sync-meteomatics', async (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }
  const meteomatics = await syncMeteomaticsWeatherForFarm(farm);
  res.json({
    meteomatics,
    datasets: getDatasets(),
    ingestionRuns: getIngestionRuns(farm.id),
    integrations: getIntegrationStatuses(),
  });
});

app.post('/api/farms/:id/edge-sync', async (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }
  const edgeSync = await invokeSupabaseEdgeSync(farm);
  const meteomatics = getCachedMeteomaticsWeather(farm.id);
  res.json({
    edgeSync,
    meteomatics,
    datasets: getDatasets(),
    ingestionRuns: getIngestionRuns(farm.id),
    integrations: getIntegrationStatuses(),
  });
});

app.post('/api/farms/:id/recommend', (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const overrides = req.body ?? {};
  const effectiveFarm: FarmRecord = {
    ...farm,
    previous_crop: (overrides.previous_crop ?? farm.previous_crop) as CropId | null,
    intended_crop: (overrides.intended_crop ?? farm.intended_crop) as CropId | null,
    priorities: Array.isArray(overrides.priorities) ? overrides.priorities : farm.priorities,
  };

  if (overrides.saveToFarm) {
    db.prepare(`UPDATE farms SET previous_crop = ?, intended_crop = ?, priorities_json = ?, updated_at = ? WHERE id = ?`).run(
      effectiveFarm.previous_crop,
      effectiveFarm.intended_crop,
      JSON.stringify(effectiveFarm.priorities),
      new Date().toISOString(),
      farm.id
    );
  }

  const indicators = getIndicators(farm.id) ?? computeAndSaveIndicators(effectiveFarm);
  const recommendation = generateAndSaveRecommendation(effectiveFarm, indicators);
  const observations = getObservations(farm.id, 'nasa-power');
  const climatology = getClimateBaseline(farm.id);
  const outlook = computeSoilMoistureAndRiskOutlook(effectiveFarm, indicators, observations, climatology);
  const rotationPlan = computeCropRotationPlan(effectiveFarm, indicators, outlook, climatology, effectiveFarm.intended_crop);
  res.json({ recommendation, indicators, outlook, rotationPlan });
});

app.post('/api/farms/:id/rotation-plan', (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const overrides = req.body ?? {};
  const effectiveFarm: FarmRecord = {
    ...farm,
    previous_crop: (overrides.previous_crop ?? farm.previous_crop) as CropId | null,
    intended_crop: (overrides.intended_crop ?? farm.intended_crop) as CropId | null,
    priorities: Array.isArray(overrides.priorities) ? overrides.priorities : farm.priorities,
  };

  if (overrides.saveToFarm) {
    db.prepare(`UPDATE farms SET previous_crop = ?, intended_crop = ?, priorities_json = ?, updated_at = ? WHERE id = ?`).run(
      effectiveFarm.previous_crop,
      effectiveFarm.intended_crop,
      JSON.stringify(effectiveFarm.priorities),
      new Date().toISOString(),
      farm.id
    );
  }

  const indicators = getIndicators(farm.id) ?? computeAndSaveIndicators(effectiveFarm);
  const recommendation = generateAndSaveRecommendation(effectiveFarm, indicators);
  const observations = getObservations(farm.id, 'nasa-power');
  const climatology = getClimateBaseline(farm.id);
  const outlook = computeSoilMoistureAndRiskOutlook(effectiveFarm, indicators, observations, climatology);
  const rotationPlan = computeCropRotationPlan(effectiveFarm, indicators, outlook, climatology, effectiveFarm.intended_crop);

  res.json({ rotationPlan, recommendation, outlook, indicators });
});

app.post('/api/farms/:id/seasons', (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const body = req.body ?? {};
  const now = new Date().toISOString();
  const validStages = new Set<GrowthStage>(['Land Prep', 'Planted', 'Vegetative', 'Flowering', 'Harvested']);

  if (body.seasonId) {
    const stage: GrowthStage = validStages.has(body.stage) ? body.stage : 'Vegetative';
    const status = stage === 'Harvested' || body.status === 'completed' ? 'completed' : 'active';
    db.prepare(`UPDATE season_cycles SET stage = ?, status = ?, harvest_outcome = COALESCE(?, harvest_outcome), notes = COALESCE(?, notes), updated_at = ? WHERE id = ? AND farm_id = ?`).run(
      stage,
      status,
      body.harvest_outcome ? String(body.harvest_outcome).slice(0, 240) : null,
      body.notes ? String(body.notes).slice(0, 240) : null,
      now,
      String(body.seasonId),
      farm.id
    );
  } else {
    // Mark any prior active seasons completed if starting a new planting cycle
    if (body.markPriorCompleted) {
      db.prepare(`UPDATE season_cycles SET status = 'completed', updated_at = ? WHERE farm_id = ? AND status = 'active'`).run(now, farm.id);
    }
    const id = `season-${crypto.randomUUID().slice(0, 8)}`;
    const stage: GrowthStage = validStages.has(body.stage) ? body.stage : 'Planted';
    const cropId = String(body.crop_id ?? 'maize');
    const plantedDate = String(body.planted_date ?? now.slice(0, 10)).slice(0, 10);
    const seasonName = String(body.season_name ?? `${cropId[0].toUpperCase() + cropId.slice(1)} Cycle (${plantedDate.slice(0, 7)})`).slice(0, 80);
    db.prepare(`
      INSERT INTO season_cycles (id, farm_id, season_name, crop_id, planted_date, stage, status, notes, harvest_outcome, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?, ?)
    `).run(id, farm.id, seasonName, cropId, plantedDate, stage, String(body.notes ?? '').slice(0, 240), now, now);
  }

  res.json({ seasons: getSeasonsForFarm(farm.id) });
});

app.post('/api/farms/:id/progress', (req, res) => {
  const farmerId = getFarmerId(req);
  const farm = getFarmById(req.params.id);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found.' });
    return;
  }
  if (!canAccessFarm(farm, farmerId)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const body = req.body ?? {};
  const now = new Date().toISOString();
  const obs = getObservations(farm.id, 'nasa-power');
  const recent7 = obs.slice(-7);
  const rain7d = Number(
    recent7
      .map((o) => o.PRECTOTCORR ?? 0)
      .reduce((a, b) => a + b, 0)
      .toFixed(1)
  );
  const ind = getIndicators(farm.id);

  const id = `log-${crypto.randomUUID().slice(0, 8)}`;
  const validStages = new Set(['Land Prep', 'Planted', 'Vegetative', 'Flowering', 'Harvested']);
  const validSoil = new Set(['Dry', 'Moist', 'Wet', 'Waterlogged']);
  const validCond = new Set(['Thriving', 'Normal', 'Stressed']);

  const stage = validStages.has(body.stage) ? String(body.stage) : 'Vegetative';
  const soilFeel = validSoil.has(body.soil_feel) ? String(body.soil_feel) : 'Moist';
  const cropCond = validCond.has(body.crop_condition) ? String(body.crop_condition) : 'Normal';
  const logDate = String(body.log_date ?? now.slice(0, 10)).slice(0, 10);

  db.prepare(`
    INSERT INTO progress_logs (
      id, farm_id, season_id, log_date, stage, soil_feel, crop_condition, note, nasa_rain_7d_mm, nasa_wetness_snapshot, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    farm.id,
    body.season_id ? String(body.season_id) : null,
    logDate,
    stage,
    soilFeel,
    cropCond,
    String(body.note ?? '').slice(0, 320),
    rain7d,
    ind?.root_wetness_index ?? null,
    now
  );

  if (body.season_id && validStages.has(stage)) {
    db.prepare(`UPDATE season_cycles SET stage = ?, status = ?, updated_at = ? WHERE id = ? AND farm_id = ?`).run(
      stage,
      stage === 'Harvested' ? 'completed' : 'active',
      now,
      String(body.season_id),
      farm.id
    );
  }

  res.status(201).json({
    progressLogs: getProgressLogsForFarm(farm.id),
    seasons: getSeasonsForFarm(farm.id),
  });
});

app.post('/api/alpha/ask', async (req, res) => {
  try {
    const farmerId = getFarmerId(req);
    const { question, language, farmId } = req.body ?? {};
    const q = String(question ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'Please ask a question or pick a topic.' });
      return;
    }

    const lang: LanguageCode = normalizeLanguageCode(language);
    const farm = farmId ? getFarmById(String(farmId)) : null;
    const accessibleFarm = farm && canAccessFarm(farm, farmerId) ? farm : null;
    const indicators = accessibleFarm ? getIndicators(accessibleFarm.id) : null;
    const recommendation = accessibleFarm ? getLatestRecommendation(accessibleFarm.id) : null;
    const outlook = accessibleFarm && indicators ? computeSoilMoistureAndRiskOutlook(accessibleFarm, indicators) : null;
    const seasons = accessibleFarm ? getSeasonsForFarm(accessibleFarm.id) : [];

    const result = await askAlphaAssistant({
      question: q.slice(0, 600),
      language: lang,
      farm: accessibleFarm,
      indicators,
      recommendation,
      outlook,
      activeSeason: seasons.find((s) => s.status === 'active') ?? seasons[0] ?? null,
    });

    res.json(result);
  } catch (err) {
    console.error('Alpha ask error:', err);
    res.status(500).json({ error: 'Alpha is temporarily unavailable.' });
  }
});

app.post('/api/alpha/speak', async (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 1200);
  const lang: LanguageCode = normalizeLanguageCode(req.body?.language);
  if (!text) {
    res.status(400).json({ error: 'Text is required for speech output.' });
    return;
  }
  const result = await synthesizeSpeechAudio(text, lang);
  if (!result) {
    res.status(503).json({ error: 'Server speech synthesis unavailable; use browser speech.' });
    return;
  }
  res.json(result);
});

app.post('/api/alpha/transcribe', async (req, res) => {
  const { audioBase64, mimeType, language } = req.body ?? {};
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    res.status(400).json({ error: 'Audio payload is required.' });
    return;
  }
  const lang: LanguageCode = normalizeLanguageCode(language);
  const result = await transcribeFarmerAudio(audioBase64, String(mimeType ?? 'audio/webm'), lang);
  if (!result) {
    res.status(503).json({ error: 'Speech transcription unavailable; please type or tap a picture option.' });
    return;
  }
  res.json(result);
});

app.post('/api/translate', async (req, res) => {
  const { text, langPair } = req.body ?? {};
  const pair = langPair === 'tw-en' ? 'tw-en' : 'en-tw';
  const result = await translateWithKhaya(String(text ?? '').slice(0, 1000), pair);
  res.json(result);
});

app.post('/api/translate/batch', async (req, res) => {
  const { texts, targetLanguage } = req.body ?? {};
  if (!Array.isArray(texts)) {
    res.status(400).json({ error: 'texts array is required.' });
    return;
  }
  const cleanTexts = texts.slice(0, 20).map((t) => String(t ?? '').slice(0, 600));
  const lang = normalizeLanguageCode(targetLanguage);
  const result = await translateTextsBatch(cleanTexts, lang);
  res.json(result);
});

async function startServer() {
  const PORT = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Farmova AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
