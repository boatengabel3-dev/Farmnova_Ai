import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ClimateBaselineMonth,
  DailyObservation,
  DatasetProvenance,
  EonetEventSummary,
  FarmIndicators,
  FarmRecord,
  GeoJsonPolygon,
  IngestionRunRecord,
  ProgressLogRecord,
  RecommendationRecord,
  SeasonCycleRecord,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'farmova.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      role TEXT NOT NULL DEFAULT 'farmer',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      gps_accuracy_m REAL,
      gps_recorded_at TEXT,
      is_at_farm INTEGER,
      location_source TEXT NOT NULL,
      location_confirmed INTEGER NOT NULL DEFAULT 0,
      boundary_geojson TEXT,
      area_hectares REAL,
      area_acres REAL,
      community TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      size_category TEXT,
      previous_crop TEXT,
      intended_crop TEXT,
      priorities_json TEXT NOT NULL DEFAULT '[]',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS crop_history (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      season_label TEXT NOT NULL,
      crop_id TEXT NOT NULL,
      notes TEXT,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_version TEXT NOT NULL,
      variables_json TEXT NOT NULL,
      unit TEXT NOT NULL,
      native_resolution TEXT NOT NULL,
      processing_method TEXT NOT NULL,
      source_reference TEXT NOT NULL,
      integration_status TEXT NOT NULL,
      status_detail TEXT NOT NULL,
      last_checked_at TEXT,
      priority_tier INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      observation_date TEXT NOT NULL,
      variables_json TEXT NOT NULL,
      raw_metadata_json TEXT,
      quality_flag TEXT NOT NULL DEFAULT 'VALID',
      is_simulated INTEGER NOT NULL DEFAULT 0,
      retrieved_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_unique
      ON observations (farm_id, dataset_id, observation_date);

    CREATE TABLE IF NOT EXISTS climate_baselines (
      farm_id TEXT PRIMARY KEY,
      months_json TEXT NOT NULL,
      elevation_m REAL,
      retrieved_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eonet_cache (
      id TEXT PRIMARY KEY,
      events_json TEXT NOT NULL,
      retrieved_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farm_indicators (
      farm_id TEXT PRIMARY KEY,
      computed_at TEXT NOT NULL,
      observation_start TEXT,
      observation_end TEXT,
      days_count INTEGER NOT NULL DEFAULT 0,
      rainfall_30d_mm REAL,
      rainfall_prev30d_mm REAL,
      rainfall_anomaly_pct REAL,
      dry_spell_days INTEGER,
      mean_temp_c REAL,
      max_temp_c REAL,
      heat_stress_days INTEGER,
      surface_wetness_index REAL,
      root_wetness_index REAL,
      solar_radiation_mj REAL,
      relative_humidity_pct REAL,
      evapotranspiration_mm_day REAL,
      elevation_m REAL,
      slope_deg REAL,
      health_category TEXT NOT NULL,
      data_source_mode TEXT NOT NULL,
      limitations_json TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      previous_crop TEXT,
      intended_crop TEXT,
      priority TEXT,
      suggested_crop TEXT NOT NULL,
      suggested_crop_id TEXT NOT NULL,
      headline_en TEXT NOT NULL,
      headline_tw TEXT NOT NULL,
      reason_en TEXT NOT NULL,
      reason_tw TEXT NOT NULL,
      next_actions_en_json TEXT NOT NULL,
      next_actions_tw_json TEXT NOT NULL,
      supporting_indicators_json TEXT NOT NULL,
      limitations_json TEXT NOT NULL,
      evidence_quality TEXT NOT NULL,
      rules_trace_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      records_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id)
    );

    CREATE TABLE IF NOT EXISTS season_cycles (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      season_name TEXT NOT NULL,
      crop_id TEXT NOT NULL,
      planted_date TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      harvest_outcome TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS progress_logs (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      season_id TEXT,
      log_date TEXT NOT NULL,
      stage TEXT NOT NULL,
      soil_feel TEXT NOT NULL,
      crop_condition TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      nasa_rain_7d_mm REAL,
      nasa_wetness_snapshot REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meteomatics_cache (
      farm_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS landsat_scenes_cache (
      farm_id TEXT PRIMARY KEY,
      scenes_json TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );
  `);

  // Safe migration for pre-existing farms table without country column
  const farmCols = db.prepare(`PRAGMA table_info(farms)`).all() as Array<{ name: string }>;
  if (!farmCols.some((c) => c.name === 'country')) {
    db.exec(`ALTER TABLE farms ADD COLUMN country TEXT NOT NULL DEFAULT ''`);
  }

  seedDatasets();
  seedDemoUserAndFarm();
}

function seedDatasets(): void {
  const datasets: DatasetProvenance[] = [
    {
      id: 'nasa-power',
      source: 'NASA Langley Research Center (LaRC) POWER Project',
      product_name: 'POWER Agroclimatology Daily Point (MERRA-2 / CERES)',
      product_version: 'v9 / API v2',
      variables: ['PRECTOTCORR', 'T2M', 'T2M_MAX', 'T2M_MIN', 'GWETTOP', 'GWETROOT', 'GWETPROF', 'ALLSKY_SFC_SW_DWN', 'RH2M', 'WS2M', 'EVPTRNS', 'EVLAND'],
      unit: 'mm/day, °C, 0–1 wetness index, MJ/m²/day, %',
      native_resolution: '~50 km (0.5° × 0.625° MERRA-2 grid)',
      processing_method: 'Direct REST daily point extraction at farm centroid; fill values (-999) filtered; 30-day & seasonal aggregation',
      source_reference: 'https://power.larc.nasa.gov/docs/',
      integration_status: 'Connected',
      status_detail: 'Live global daily point endpoint integrated for any coordinate worldwide.',
      last_checked_at: null,
      priority_tier: 1,
    },
    {
      id: 'nasa-power-climatology',
      source: 'NASA Langley Research Center (LaRC) POWER Climatology',
      product_name: 'POWER 20-Year Monthly Agroclimatology Normal',
      product_version: 'v9 Climatology',
      variables: ['PRECTOTCORR', 'T2M', 'GWETROOT'],
      unit: 'mm/day, °C, 0–1 wetness index',
      native_resolution: '~50 km global grid',
      processing_method: 'Monthly long-term baseline compared against recent 30-day observations for climate anomaly & water-balance outlook',
      source_reference: 'https://power.larc.nasa.gov/docs/',
      integration_status: 'Connected',
      status_detail: 'Live 20-year monthly normal endpoint integrated for global climate anomaly & soil moisture projection.',
      last_checked_at: null,
      priority_tier: 1,
    },
    {
      id: 'nasa-eonet',
      source: 'NASA Earth Observatory Natural Event Tracker (EONET)',
      product_name: 'Global Real-Time Natural Hazard & Disaster Feed',
      product_version: 'API v3',
      variables: ['Wildfires', 'Severe Storms', 'Floods', 'Drought', 'Dust & Haze'],
      unit: 'GeoJSON event coordinates & proximity (km)',
      native_resolution: 'Event-level global hazard tracking',
      processing_method: 'Live EONET v3 open event ingestion + Haversine distance check against farm coordinates',
      source_reference: 'https://eonet.gsfc.nasa.gov/docs/v3',
      integration_status: 'Connected',
      status_detail: 'Live global disaster proximity tracking active.',
      last_checked_at: null,
      priority_tier: 1,
    },
    {
      id: 'nasa-gibs',
      source: 'NASA EOSDIS Global Imagery Browse Services (GIBS)',
      product_name: 'Landsat WELD 30m True Color, VIIRS NOAA-20 & MODIS Terra True Color, MODIS 8-Day NDVI, IMERG Rain, 15m Reference Features',
      product_version: 'WMTS 1.0.0 EPSG:3857 Best',
      variables: [
        'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual',
        'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
        'MODIS_Terra_CorrectedReflectance_TrueColor',
        'MODIS_Terra_NDVI_8Day',
        'IMERG_Precipitation_Rate',
        'BlueMarble_NextGeneration',
        'Reference_Features_15m',
      ],
      unit: 'Visual RGB / Color-mapped Imagery Tiles (precision GPS tracking underlay)',
      native_resolution: '15m (Reference) · 30m (Landsat WELD) · 250m–375m (VIIRS/MODIS)',
      processing_method: 'Live date-probed OGC WMTS tiles over Leaflet farm boundary & live GPS track worldwide',
      source_reference: 'https://nasa-gibs.github.io/gibs-api-docs/',
      integration_status: 'Imagery Active',
      status_detail: 'Verified HTTP 200 global WMTS layers with automatic date fallback.',
      last_checked_at: null,
      priority_tier: 1,
    },
    {
      id: 'nasa-srtm',
      source: 'NASA / USGS Shuttle Radar Topography Mission (SRTM)',
      product_name: 'SRTMGL1 Global 1 Arc-Second DEM + POWER Grid Elevation',
      product_version: 'v003',
      variables: ['Elevation (m)', 'Derived Terrain Slope (°)'],
      unit: 'Meters (m), Degrees (°)',
      native_resolution: '~30 m (SRTMGL1) / POWER cell elevation fallback',
      processing_method: 'CMR granule discovery for SRTMGL1 v003 + terrain context',
      source_reference: 'https://lpdaac.usgs.gov/products/srtmgl1v003/',
      integration_status: 'Connected',
      status_detail: 'CMR granule lookup + POWER elevation; HGT raster parsing requires Earthdata token.',
      last_checked_at: null,
      priority_tier: 1,
    },
    {
      id: 'nasa-gpm-imerg',
      source: 'NASA Goddard Space Flight Center (GSFC) GPM',
      product_name: 'GPM IMERG Final Precipitation L3 Daily (GPM_3IMERGDF)',
      product_version: 'V07',
      variables: ['precipitationCal', 'precipitationQualityIndex'],
      unit: 'mm/day',
      native_resolution: '0.1° (~10 km)',
      processing_method: 'Earthdata CMR granule discovery; NetCDF raster extraction requires Earthdata authentication',
      source_reference: 'https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDF_07/summary',
      integration_status: 'Metadata Discovery',
      status_detail: 'CMR granule discovery active; NetCDF pixel extraction awaits NASA_EARTHDATA_TOKEN.',
      last_checked_at: null,
      priority_tier: 2,
    },
    {
      id: 'nasa-smap',
      source: 'NASA / NSIDC Soil Moisture Active Passive (SMAP)',
      product_name: 'SMAP Enhanced L3 Radiometer Global Daily Soil Moisture (SPL3SMP_E / SPL4SMGP)',
      product_version: 'R19 / V007',
      variables: ['soil_moisture', 'sm_rootzone'],
      unit: 'm³/m³',
      native_resolution: '9 km',
      processing_method: 'Earthdata CMR granule discovery; HDF5 raster extraction requires Earthdata authentication',
      source_reference: 'https://nsidc.org/data/SPL3SMP_E',
      integration_status: 'Metadata Discovery',
      status_detail: 'CMR granule discovery active; HDF5 worker awaits NASA_EARTHDATA_TOKEN.',
      last_checked_at: null,
      priority_tier: 2,
    },
    {
      id: 'usgs-landsat',
      source: 'NASA / USGS Landsat Collection 2 Level-2',
      product_name: 'Landsat 8/9 OLI-TIRS Surface Reflectance & Surface Temperature',
      product_version: 'Collection 2 Level-2',
      variables: ['SR_B4', 'SR_B5', 'ST_B10', 'eo:cloud_cover'],
      unit: 'Reflectance / Kelvin',
      native_resolution: '30 m',
      processing_method: 'USGS LandsatLook STAC API scene discovery with cloud-cover filtering',
      source_reference: 'https://landsatlook.usgs.gov/stac-server',
      integration_status: 'Metadata Discovery',
      status_detail: 'Live STAC scene discovery checks cloud-free scenes over farm coordinates.',
      last_checked_at: null,
      priority_tier: 3,
    },
    {
      id: 'nasa-modis',
      source: 'NASA EOSDIS MODIS Land Processes DAAC',
      product_name: 'MODIS/Terra Vegetation Indices 8-Day / 16-Day (MOD13Q1)',
      product_version: 'v061',
      variables: ['MODIS_Terra_NDVI_8Day', 'NDVI', 'EVI'],
      unit: 'NDVI (-0.2 to 1.0)',
      native_resolution: '250 m',
      processing_method: 'GIBS WMTS visual NDVI overlay integrated; numerical HDF-EOS time series not yet connected',
      source_reference: 'https://lpdaac.usgs.gov/products/mod13q1v061/',
      integration_status: 'Imagery Active',
      status_detail: 'Visual NDVI overlay active in map; numerical pixel extraction not yet connected.',
      last_checked_at: null,
      priority_tier: 3,
    },
    {
      id: 'nasa-ecostress',
      source: 'NASA JPL ECOSTRESS',
      product_name: 'ECO_L2T_LSTE & ECO_L3T_JET (Global Land Surface Temp & ET)',
      product_version: 'v002',
      variables: ['LST', 'ETdaily'],
      unit: 'K, W/m²',
      native_resolution: '70 m',
      processing_method: 'Earthdata CMR discovery',
      source_reference: 'https://ecostress.jpl.nasa.gov/data',
      integration_status: 'Not yet connected',
      status_detail: 'Not yet connected. Planned for irregular-revisit thermal stress verification.',
      last_checked_at: null,
      priority_tier: 3,
    },
    {
      id: 'nasa-grace',
      source: 'NASA / DLR GRACE & GRACE-FO',
      product_name: 'GRACE Tellus Terrestrial Water Storage Anomaly',
      product_version: 'RL06',
      variables: ['lwe_thickness'],
      unit: 'cm equivalent water thickness',
      native_resolution: '~300 km (regional basin scale only)',
      processing_method: 'Regional water-storage context only',
      source_reference: 'https://grace.jpl.nasa.gov/',
      integration_status: 'Not yet connected',
      status_detail: 'Not yet connected. Coarse regional groundwater context planned.',
      last_checked_at: null,
      priority_tier: 3,
    },
    {
      id: 'nasa-gedi',
      source: 'NASA / UMD GEDI Ecosystem Lidar',
      product_name: 'GEDI L2B Canopy Cover & Vertical Profile Metrics',
      product_version: 'v002',
      variables: ['cover', 'pai'],
      unit: 'Fraction, m²/m²',
      native_resolution: '25 m footprint (orbital tracks)',
      processing_method: 'Track-based biomass/canopy context verification',
      source_reference: 'https://gedi.umd.edu/',
      integration_status: 'Not yet connected',
      status_detail: 'Not yet connected. Orbital track coverage verification planned.',
      last_checked_at: null,
      priority_tier: 3,
    },
    {
      id: 'meteomatics-live',
      source: 'Meteomatics Weather API',
      product_name: 'High-Resolution 6-Hourly Live Weather & 72h Forecast Point API',
      product_version: 'REST JSON v1',
      variables: ['t_2m:C', 'precip_1h:mm', 'relative_humidity_2m:p', 'wind_speed_10m:ms', 'volumetric_soil_water_-5cm:m3m3', 'weather_symbol_1h:idx'],
      unit: '°C, mm/h, %, m/s, m³/m³',
      native_resolution: '90m downscaled global weather grid',
      processing_method: 'Server-side Basic Auth REST call (or via Supabase Edge Function farmova-sync) cached in SQLite',
      source_reference: 'https://www.meteomatics.com/en/api/overview/',
      integration_status: process.env.METEOMATICS_USERNAME && process.env.METEOMATICS_PASSWORD ? 'Connected' : 'Credentials Required',
      status_detail: process.env.METEOMATICS_USERNAME && process.env.METEOMATICS_PASSWORD
        ? 'Meteomatics API credentials configured for live 72h weather & soil water forecasts.'
        : 'Set METEOMATICS_USERNAME and METEOMATICS_PASSWORD to stream live 6h weather & 5cm soil water forecasts.',
      last_checked_at: null,
      priority_tier: 1,
    },
    {
      id: 'supabase-edge',
      source: 'Supabase Edge Functions (Deno Runtime)',
      product_name: 'farmova-sync Distributed Weather & Hazard Sync Edge Worker',
      product_version: 'Deno Serve v1',
      variables: ['meteomatics', 'nasaEonet'],
      unit: 'Edge JSON telemetry',
      native_resolution: 'Low-latency global edge execution',
      processing_method: 'Express proxy forwards coordinates to deployed Supabase Edge Function with Bearer auth',
      source_reference: 'https://supabase.com/docs/guides/functions',
      integration_status: (process.env.SUPABASE_EDGE_FUNCTION_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) ? 'Connected' : 'Credentials Required',
      status_detail: (process.env.SUPABASE_EDGE_FUNCTION_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
        ? `Supabase endpoint configured (${(process.env.SUPABASE_EDGE_FUNCTION_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim()}).`
        : 'Deploy supabase/functions/farmova-sync and set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
      last_checked_at: null,
      priority_tier: 1,
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO datasets (
      id, source, product_name, product_version, variables_json, unit,
      native_resolution, processing_method, source_reference, integration_status,
      status_detail, last_checked_at, priority_tier
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      product_name = excluded.product_name,
      product_version = excluded.product_version,
      variables_json = excluded.variables_json,
      unit = excluded.unit,
      native_resolution = excluded.native_resolution,
      processing_method = excluded.processing_method,
      source_reference = excluded.source_reference,
      priority_tier = excluded.priority_tier
  `);

  for (const d of datasets) {
    stmt.run(
      d.id,
      d.source,
      d.product_name,
      d.product_version,
      JSON.stringify(d.variables),
      d.unit,
      d.native_resolution,
      d.processing_method,
      d.source_reference,
      d.integration_status,
      d.status_detail,
      d.last_checked_at,
      d.priority_tier
    );
  }

  // Keep env-driven dataset statuses synced on boot when credentials are provided
  const supaUrl = (process.env.SUPABASE_EDGE_FUNCTION_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  if (supaUrl) {
    db.prepare(`UPDATE datasets SET integration_status = 'Connected', status_detail = ? WHERE id = 'supabase-edge' AND integration_status = 'Credentials Required'`).run(
      `Supabase project configured (${supaUrl}). Ready to invoke farmova-sync.`
    );
  }
  if (process.env.METEOMATICS_USERNAME && process.env.METEOMATICS_PASSWORD) {
    db.prepare(`UPDATE datasets SET integration_status = 'Connected', status_detail = ? WHERE id = 'meteomatics-live' AND integration_status = 'Credentials Required'`).run(
      'Meteomatics API credentials configured for live 72h weather & soil water forecasts.'
    );
  }
}

function seedDemoUserAndFarm(): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO users (id, name, preferred_language, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('demo-farmer', 'Kofi Mensah', 'en', 'farmer', now);

  const existingDemo = db.prepare(`SELECT id FROM farms WHERE id = ?`).get('demo-ejura-farm');
  if (!existingDemo) {
    const demoBoundary: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-1.3612, 7.3832],
        [-1.3596, 7.3832],
        [-1.3596, 7.3818],
        [-1.3612, 7.3818],
        [-1.3612, 7.3832],
      ]],
    };

    db.prepare(`
      INSERT INTO farms (
        id, owner_id, name, latitude, longitude, gps_accuracy_m, gps_recorded_at,
        is_at_farm, location_source, location_confirmed, boundary_geojson,
        area_hectares, area_acres, community, district, region, country, size_category,
        previous_crop, intended_crop, priorities_json, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'demo-ejura-farm',
      'demo-farmer',
      'Demo Farm — Ejura Maize Plot',
      7.3825,
      -1.3602,
      8.5,
      now,
      1,
      'demo',
      1,
      JSON.stringify(demoBoundary),
      2.74,
      6.77,
      'Ejura',
      'Ejura-Sekyedumase',
      'Ashanti',
      'Ghana',
      'medium',
      'maize',
      'help_me_decide',
      JSON.stringify(['improve_soil', 'less_water_stress']),
      1,
      now,
      now
    );

    db.prepare(`
      INSERT INTO crop_history (id, farm_id, season_label, crop_id, notes, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'demo-hist-1',
      'demo-ejura-farm',
      'Major Season (Prior)',
      'maize',
      'Demonstration farm baseline crop record.',
      now
    );
  } else {
    db.prepare(`UPDATE farms SET country = 'Ghana' WHERE id = 'demo-ejura-farm' AND country = ''`).run();
  }

  // Seed initial season & progress log for demo farm if empty
  const existingSeason = db.prepare(`SELECT id FROM season_cycles WHERE farm_id = ?`).get('demo-ejura-farm');
  if (!existingSeason) {
    const plantedDate = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
    const prevDate = new Date(Date.now() - 140 * 86400_000).toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO season_cycles (
        id, farm_id, season_name, crop_id, planted_date, stage, status, notes, harvest_outcome, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'demo-season-prev',
      'demo-ejura-farm',
      'Major Season (Completed)',
      'maize',
      prevDate,
      'Harvested',
      'completed',
      'Demonstrates multi-season crop rotation history.',
      'Harvested — followed by legume rotation to rebuild nitrogen.',
      now,
      now
    );

    db.prepare(`
      INSERT INTO season_cycles (
        id, farm_id, season_name, crop_id, planted_date, stage, status, notes, harvest_outcome, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'demo-season-active',
      'demo-ejura-farm',
      'Minor Season Rotation',
      'cowpea',
      plantedDate,
      'Vegetative',
      'active',
      'Tracking cowpea rotation progress after maize.',
      null,
      now,
      now
    );

    db.prepare(`
      INSERT INTO progress_logs (
        id, farm_id, season_id, log_date, stage, soil_feel, crop_condition, note, nasa_rain_7d_mm, nasa_wetness_snapshot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'demo-log-1',
      'demo-ejura-farm',
      'demo-season-active',
      new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10),
      'Vegetative',
      'Moist',
      'Normal',
      'Plants emerging evenly; mulched between rows to conserve soil moisture.',
      12.4,
      0.52,
      now
    );
  }
}

export function rowToFarm(row: Record<string, unknown>): FarmRecord {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    name: String(row.name),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    gps_accuracy_m: row.gps_accuracy_m === null ? null : Number(row.gps_accuracy_m),
    gps_recorded_at: row.gps_recorded_at ? String(row.gps_recorded_at) : null,
    is_at_farm: row.is_at_farm === null ? null : Boolean(row.is_at_farm),
    location_source: String(row.location_source) as FarmRecord['location_source'],
    location_confirmed: Boolean(row.location_confirmed),
    boundary_geojson: row.boundary_geojson ? (JSON.parse(String(row.boundary_geojson)) as GeoJsonPolygon) : null,
    area_hectares: row.area_hectares === null ? null : Number(row.area_hectares),
    area_acres: row.area_acres === null ? null : Number(row.area_acres),
    community: String(row.community ?? ''),
    district: String(row.district ?? ''),
    region: String(row.region ?? ''),
    country: String(row.country ?? ''),
    size_category: row.size_category ? String(row.size_category) : null,
    previous_crop: (row.previous_crop ? String(row.previous_crop) : null) as FarmRecord['previous_crop'],
    intended_crop: (row.intended_crop ? String(row.intended_crop) : null) as FarmRecord['intended_crop'],
    priorities: JSON.parse(String(row.priorities_json ?? '[]')),
    is_demo: Boolean(row.is_demo),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function getAllFarms(ownerId?: string): FarmRecord[] {
  const rows = ownerId
    ? (db.prepare('SELECT * FROM farms WHERE owner_id = ? OR is_demo = 1 ORDER BY is_demo ASC, updated_at DESC').all(ownerId) as Record<string, unknown>[])
    : (db.prepare('SELECT * FROM farms ORDER BY is_demo ASC, updated_at DESC').all() as Record<string, unknown>[]);
  return rows.map(rowToFarm);
}

export function getFarmById(id: string): FarmRecord | null {
  const row = db.prepare('SELECT * FROM farms WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToFarm(row) : null;
}

export function getDatasets(): DatasetProvenance[] {
  const rows = db.prepare('SELECT * FROM datasets ORDER BY priority_tier ASC, id ASC').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    source: String(r.source),
    product_name: String(r.product_name),
    product_version: String(r.product_version),
    variables: JSON.parse(String(r.variables_json)),
    unit: String(r.unit),
    native_resolution: String(r.native_resolution),
    processing_method: String(r.processing_method),
    source_reference: String(r.source_reference),
    integration_status: String(r.integration_status) as DatasetProvenance['integration_status'],
    status_detail: String(r.status_detail),
    last_checked_at: r.last_checked_at ? String(r.last_checked_at) : null,
    priority_tier: Number(r.priority_tier) as 1 | 2 | 3,
  }));
}

export function getObservations(farmId: string, datasetId = 'nasa-power'): Array<DailyObservation & { is_simulated: boolean; quality_flag: string; retrieved_at: string }> {
  const rows = db.prepare(`
    SELECT observation_date, variables_json, quality_flag, is_simulated, retrieved_at
    FROM observations
    WHERE farm_id = ? AND dataset_id = ?
    ORDER BY observation_date ASC
  `).all(farmId, datasetId) as Record<string, unknown>[];

  return rows.map((r) => {
    const vars = JSON.parse(String(r.variables_json));
    return {
      date: String(r.observation_date),
      PRECTOTCORR: vars.PRECTOTCORR ?? null,
      T2M: vars.T2M ?? null,
      T2M_MAX: vars.T2M_MAX ?? null,
      T2M_MIN: vars.T2M_MIN ?? null,
      GWETTOP: vars.GWETTOP ?? null,
      GWETROOT: vars.GWETROOT ?? null,
      GWETPROF: vars.GWETPROF ?? null,
      ALLSKY_SFC_SW_DWN: vars.ALLSKY_SFC_SW_DWN ?? null,
      RH2M: vars.RH2M ?? null,
      WS2M: vars.WS2M ?? null,
      EVPTRNS: vars.EVPTRNS ?? null,
      EVLAND: vars.EVLAND ?? null,
      is_simulated: Boolean(r.is_simulated),
      quality_flag: String(r.quality_flag),
      retrieved_at: String(r.retrieved_at),
    };
  });
}

export function getClimateBaseline(farmId: string): ClimateBaselineMonth[] {
  const row = db.prepare(`SELECT months_json FROM climate_baselines WHERE farm_id = ?`).get(farmId) as { months_json?: string } | undefined;
  if (!row?.months_json) return [];
  return JSON.parse(row.months_json) as ClimateBaselineMonth[];
}

export function getCachedEonetEvents(): Array<Omit<EonetEventSummary, 'distance_km'>> {
  const row = db.prepare(`SELECT events_json FROM eonet_cache WHERE id = 'global-open'`).get() as { events_json?: string } | undefined;
  if (!row?.events_json) return [];
  return JSON.parse(row.events_json);
}

export function getIndicators(farmId: string): FarmIndicators | null {
  const r = db.prepare('SELECT * FROM farm_indicators WHERE farm_id = ?').get(farmId) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    farm_id: String(r.farm_id),
    computed_at: String(r.computed_at),
    observation_start: r.observation_start ? String(r.observation_start) : null,
    observation_end: r.observation_end ? String(r.observation_end) : null,
    days_count: Number(r.days_count),
    rainfall_30d_mm: r.rainfall_30d_mm === null ? null : Number(r.rainfall_30d_mm),
    rainfall_prev30d_mm: r.rainfall_prev30d_mm === null ? null : Number(r.rainfall_prev30d_mm),
    rainfall_anomaly_pct: r.rainfall_anomaly_pct === null ? null : Number(r.rainfall_anomaly_pct),
    dry_spell_days: r.dry_spell_days === null ? null : Number(r.dry_spell_days),
    mean_temp_c: r.mean_temp_c === null ? null : Number(r.mean_temp_c),
    max_temp_c: r.max_temp_c === null ? null : Number(r.max_temp_c),
    heat_stress_days: r.heat_stress_days === null ? null : Number(r.heat_stress_days),
    surface_wetness_index: r.surface_wetness_index === null ? null : Number(r.surface_wetness_index),
    root_wetness_index: r.root_wetness_index === null ? null : Number(r.root_wetness_index),
    solar_radiation_mj: r.solar_radiation_mj === null ? null : Number(r.solar_radiation_mj),
    relative_humidity_pct: r.relative_humidity_pct === null ? null : Number(r.relative_humidity_pct),
    evapotranspiration_mm_day: r.evapotranspiration_mm_day === null ? null : Number(r.evapotranspiration_mm_day),
    elevation_m: r.elevation_m === null ? null : Number(r.elevation_m),
    slope_deg: r.slope_deg === null ? null : Number(r.slope_deg),
    health_category: String(r.health_category) as FarmIndicators['health_category'],
    data_source_mode: String(r.data_source_mode) as FarmIndicators['data_source_mode'],
    limitations: JSON.parse(String(r.limitations_json)),
  };
}

export function getLatestRecommendation(farmId: string): RecommendationRecord | null {
  const r = db.prepare('SELECT * FROM recommendations WHERE farm_id = ? ORDER BY created_at DESC LIMIT 1').get(farmId) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    farm_id: String(r.farm_id),
    previous_crop: r.previous_crop ? String(r.previous_crop) : null,
    intended_crop: r.intended_crop ? String(r.intended_crop) : null,
    priority: r.priority ? String(r.priority) : null,
    suggested_crop: String(r.suggested_crop),
    suggested_crop_id: String(r.suggested_crop_id) as RecommendationRecord['suggested_crop_id'],
    headline_en: String(r.headline_en),
    headline_tw: String(r.headline_tw),
    reason_en: String(r.reason_en),
    reason_tw: String(r.reason_tw),
    next_actions_en: JSON.parse(String(r.next_actions_en_json)),
    next_actions_tw: JSON.parse(String(r.next_actions_tw_json)),
    supporting_indicators: JSON.parse(String(r.supporting_indicators_json)),
    limitations: JSON.parse(String(r.limitations_json)),
    evidence_quality: String(r.evidence_quality) as RecommendationRecord['evidence_quality'],
    rules_trace: JSON.parse(String(r.rules_trace_json)),
    created_at: String(r.created_at),
  };
}

export function getIngestionRuns(farmId?: string): IngestionRunRecord[] {
  const rows = farmId
    ? (db.prepare('SELECT * FROM ingestion_runs WHERE farm_id = ? ORDER BY started_at DESC LIMIT 30').all(farmId) as Record<string, unknown>[])
    : (db.prepare('SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 50').all() as Record<string, unknown>[]);
  return rows.map((r) => ({
    id: String(r.id),
    farm_id: String(r.farm_id),
    dataset_id: String(r.dataset_id),
    status: String(r.status) as IngestionRunRecord['status'],
    started_at: String(r.started_at),
    finished_at: r.finished_at ? String(r.finished_at) : null,
    records_count: Number(r.records_count),
    error_message: r.error_message ? String(r.error_message) : null,
  }));
}

export function getSeasonsForFarm(farmId: string): SeasonCycleRecord[] {
  const obs = getObservations(farmId, 'nasa-power');
  const rows = db.prepare('SELECT * FROM season_cycles WHERE farm_id = ? ORDER BY planted_date DESC, created_at DESC').all(farmId) as Record<string, unknown>[];
  return rows.map((r) => {
    const plantedDate = String(r.planted_date);
    const sincePlanting = obs.filter((o) => o.date >= plantedDate);
    const rainVals = sincePlanting.map((o) => o.PRECTOTCORR).filter((v): v is number => v !== null);
    const tempVals = sincePlanting.map((o) => o.T2M).filter((v): v is number => v !== null);
    return {
      id: String(r.id),
      farm_id: String(r.farm_id),
      season_name: String(r.season_name),
      crop_id: String(r.crop_id) as SeasonCycleRecord['crop_id'],
      planted_date: plantedDate,
      stage: String(r.stage) as SeasonCycleRecord['stage'],
      status: String(r.status) as SeasonCycleRecord['status'],
      notes: String(r.notes ?? ''),
      harvest_outcome: r.harvest_outcome ? String(r.harvest_outcome) : null,
      nasa_rain_since_planting_mm: rainVals.length > 0 ? Number(rainVals.reduce((a, b) => a + b, 0).toFixed(1)) : null,
      nasa_mean_temp_since_planting_c: tempVals.length > 0 ? Number((tempVals.reduce((a, b) => a + b, 0) / tempVals.length).toFixed(1)) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  });
}

export function getProgressLogsForFarm(farmId: string): ProgressLogRecord[] {
  const rows = db.prepare('SELECT * FROM progress_logs WHERE farm_id = ? ORDER BY log_date DESC, created_at DESC LIMIT 40').all(farmId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    farm_id: String(r.farm_id),
    season_id: r.season_id ? String(r.season_id) : null,
    log_date: String(r.log_date),
    stage: String(r.stage) as ProgressLogRecord['stage'],
    soil_feel: String(r.soil_feel) as ProgressLogRecord['soil_feel'],
    crop_condition: String(r.crop_condition) as ProgressLogRecord['crop_condition'],
    note: String(r.note ?? ''),
    nasa_rain_7d_mm: r.nasa_rain_7d_mm === null ? null : Number(r.nasa_rain_7d_mm),
    nasa_wetness_snapshot: r.nasa_wetness_snapshot === null ? null : Number(r.nasa_wetness_snapshot),
    created_at: String(r.created_at),
  }));
}
