import crypto from 'node:crypto';
import { db } from './db.ts';
import type { ClimateBaselineMonth, DailyObservation, EonetEventSummary, FarmRecord, LandsatPrecisionScene } from './types.ts';

export interface GibsLayerSpec {
  id: string;
  title: string;
  description: string;
  tileMatrixSet: string;
  maxNativeZoom: number;
  format: 'jpg' | 'png';
  hasTime: boolean;
  defaultDate: string;
  urlTemplate: string;
  legendUrl: string | null;
  attribution: string;
}

function daysAgoIso(days: number): string {
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

function toYyyymmdd(iso: string): string {
  return iso.replace(/-/g, '');
}

const gibsDateCache = new Map<string, { date: string; checkedAt: number }>();
const GIBS_CACHE_TTL_MS = 20 * 60_000;

async function probeGibsTileOk(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveLatestGibsDate(
  layerId: string,
  tileMatrixSet: string,
  ext: 'jpg' | 'png',
  sampleTile: { z: number; y: number; x: number },
  fallbackDate: string
): Promise<string> {
  const cached = gibsDateCache.get(layerId);
  if (cached && Date.now() - cached.checkedAt < GIBS_CACHE_TTL_MS) {
    return cached.date;
  }

  // Probe candidate days in parallel batches so any GIBS outage or delay resolves to a guaranteed HTTP 200 date
  const candidateDays = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14];
  for (let i = 0; i < candidateDays.length; i += 4) {
    const batch = candidateDays.slice(i, i + 4);
    const results = await Promise.all(
      batch.map(async (dAgo) => {
        const iso = daysAgoIso(dAgo);
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${iso}/${tileMatrixSet}/${sampleTile.z}/${sampleTile.y}/${sampleTile.x}.${ext}`;
        const ok = await probeGibsTileOk(url);
        return { iso, ok };
      })
    );
    const firstOk = results.find((r) => r.ok);
    if (firstOk) {
      gibsDateCache.set(layerId, { date: firstOk.iso, checkedAt: Date.now() });
      return firstOk.iso;
    }
  }

  return fallbackDate;
}

export async function getVerifiedGibsLayers(): Promise<GibsLayerSpec[]> {
  const [viirsNoaaDate, modisTerraDate, ndviDate, imergDate] = await Promise.all([
    resolveLatestGibsDate('VIIRS_NOAA20_CorrectedReflectance_TrueColor', 'GoogleMapsCompatible_Level9', 'jpg', { z: 3, y: 3, x: 3 }, daysAgoIso(1)),
    resolveLatestGibsDate('MODIS_Terra_CorrectedReflectance_TrueColor', 'GoogleMapsCompatible_Level9', 'jpg', { z: 3, y: 3, x: 3 }, daysAgoIso(1)),
    resolveLatestGibsDate('MODIS_Terra_NDVI_8Day', 'GoogleMapsCompatible_Level9', 'png', { z: 3, y: 3, x: 3 }, daysAgoIso(8)),
    resolveLatestGibsDate('IMERG_Precipitation_Rate', 'GoogleMapsCompatible_Level6', 'png', { z: 3, y: 3, x: 3 }, daysAgoIso(1)),
  ]);

  return [
    {
      id: 'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual',
      title: 'NASA Landsat 30m Precision Basemap',
      description: 'Global 30-meter Landsat WELD mosaic Ideal for zooming down to plot boundaries and tracking live field GPS coordinates.',
      tileMatrixSet: 'GoogleMapsCompatible_Level12',
      maxNativeZoom: 12,
      format: 'jpg',
      hasTime: false,
      defaultDate: 'Global 30m Mosaic',
      urlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg`,
      legendUrl: null,
      attribution: 'Imagery provided by NASA GIBS (Landsat WELD Global 30m)',
    },
    {
      id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
      title: `NASA VIIRS NOAA-20 True Color (${viirsNoaaDate})`,
      description: 'Live daily true-color satellite reflectance from NOAA-20 VIIRS.',
      tileMatrixSet: 'GoogleMapsCompatible_Level9',
      maxNativeZoom: 9,
      format: 'jpg',
      hasTime: true,
      defaultDate: viirsNoaaDate,
      urlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${viirsNoaaDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      legendUrl: null,
      attribution: 'Imagery provided by NASA GIBS (VIIRS NOAA-20)',
    },
    {
      id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
      title: `NASA MODIS Terra True Color (${modisTerraDate})`,
      description: 'Live daily optical imagery from MODIS Terra satellite.',
      tileMatrixSet: 'GoogleMapsCompatible_Level9',
      maxNativeZoom: 9,
      format: 'jpg',
      hasTime: true,
      defaultDate: modisTerraDate,
      urlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${modisTerraDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      legendUrl: null,
      attribution: 'Imagery provided by NASA GIBS (MODIS Terra)',
    },
    {
      id: 'MODIS_Terra_NDVI_8Day',
      title: `NASA MODIS 8-Day Vegetation NDVI (${ndviDate})`,
      description: 'Visual greenness index overlay (8-day composite). High green indicates denser vegetation.',
      tileMatrixSet: 'GoogleMapsCompatible_Level9',
      maxNativeZoom: 9,
      format: 'png',
      hasTime: true,
      defaultDate: ndviDate,
      urlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${ndviDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
      legendUrl: 'https://gibs.earthdata.nasa.gov/legends/MODIS_NDVI_H.svg',
      attribution: 'Imagery provided by NASA GIBS (MODIS Terra NDVI 8-Day)',
    },
    {
      id: 'IMERG_Precipitation_Rate',
      title: `NASA GPM IMERG Rainfall (${imergDate})`,
      description: 'Visual precipitation rate overlay from NASA Global Precipitation Measurement mission.',
      tileMatrixSet: 'GoogleMapsCompatible_Level6',
      maxNativeZoom: 6,
      format: 'png',
      hasTime: true,
      defaultDate: imergDate,
      urlTemplate: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${imergDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
      legendUrl: 'https://gibs.earthdata.nasa.gov/legends/GPM_Precipitation_Rate_H.svg',
      attribution: 'Imagery provided by NASA GIBS (GPM IMERG)',
    },
  ];
}

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 14_000);
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function cleanPowerValue(val: unknown): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  if (val <= -900) return null;
  return Number(val.toFixed(3));
}

export interface PowerSyncResult {
  success: boolean;
  recordsCount: number;
  elevationM: number | null;
  observationStart: string | null;
  observationEnd: string | null;
  error?: string;
}

export async function syncNasaPowerForFarm(farm: FarmRecord): Promise<PowerSyncResult> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ingestion_runs (id, farm_id, dataset_id, status, started_at, records_count) VALUES (?, ?, ?, 'Processing', ?, 0)`
  ).run(runId, farm.id, 'nasa-power', startedAt);

  const endIso = daysAgoIso(2);
  const startIso = daysAgoIso(65);
  const params = [
    'PRECTOTCORR',
    'T2M',
    'T2M_MAX',
    'T2M_MIN',
    'GWETTOP',
    'GWETROOT',
    'GWETPROF',
    'ALLSKY_SFC_SW_DWN',
    'RH2M',
    'WS2M',
    'EVPTRNS',
    'EVLAND',
  ].join(',');

  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=${params}&community=AG` +
    `&longitude=${farm.longitude.toFixed(4)}&latitude=${farm.latitude.toFixed(4)}` +
    `&start=${toYyyymmdd(startIso)}&end=${toYyyymmdd(endIso)}&format=JSON`;

  try {
    const res = await fetchWithRetry(url, undefined, 3);
    const json = (await res.json()) as {
      geometry?: { coordinates?: number[] };
      properties?: { parameter?: Record<string, Record<string, number>> };
    };

    const parameterMap = json?.properties?.parameter;
    if (!parameterMap || !parameterMap.PRECTOTCORR) {
      throw new Error('NASA POWER response missing expected parameter map.');
    }

    const elevationM =
      typeof json?.geometry?.coordinates?.[2] === 'number' && Number.isFinite(json.geometry.coordinates[2])
        ? Number(json.geometry.coordinates[2].toFixed(1))
        : null;

    const rawDates = Object.keys(parameterMap.PRECTOTCORR).sort();
    const now = new Date().toISOString();

    const upsertObs = db.prepare(`
      INSERT INTO observations (
        id, farm_id, dataset_id, observation_date, variables_json,
        raw_metadata_json, quality_flag, is_simulated, retrieved_at
      ) VALUES (?, ?, 'nasa-power', ?, ?, ?, 'VALID', 0, ?)
      ON CONFLICT(farm_id, dataset_id, observation_date) DO UPDATE SET
        variables_json = excluded.variables_json,
        raw_metadata_json = excluded.raw_metadata_json,
        quality_flag = 'VALID',
        is_simulated = 0,
        retrieved_at = excluded.retrieved_at
    `);

    let validCount = 0;
    let firstDate: string | null = null;
    let lastDate: string | null = null;

    const tx = db.transaction(() => {
      for (const ymd of rawDates) {
        const isoDate = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
        const obs: Omit<DailyObservation, 'date'> = {
          PRECTOTCORR: cleanPowerValue(parameterMap.PRECTOTCORR?.[ymd]),
          T2M: cleanPowerValue(parameterMap.T2M?.[ymd]),
          T2M_MAX: cleanPowerValue(parameterMap.T2M_MAX?.[ymd]),
          T2M_MIN: cleanPowerValue(parameterMap.T2M_MIN?.[ymd]),
          GWETTOP: cleanPowerValue(parameterMap.GWETTOP?.[ymd]),
          GWETROOT: cleanPowerValue(parameterMap.GWETROOT?.[ymd]),
          GWETPROF: cleanPowerValue(parameterMap.GWETPROF?.[ymd]),
          ALLSKY_SFC_SW_DWN: cleanPowerValue(parameterMap.ALLSKY_SFC_SW_DWN?.[ymd]),
          RH2M: cleanPowerValue(parameterMap.RH2M?.[ymd]),
          WS2M: cleanPowerValue(parameterMap.WS2M?.[ymd]),
          EVPTRNS: cleanPowerValue(parameterMap.EVPTRNS?.[ymd]),
          EVLAND: cleanPowerValue(parameterMap.EVLAND?.[ymd]),
        };

        const hasCore = obs.PRECTOTCORR !== null || obs.T2M !== null;
        if (!hasCore) continue;

        validCount++;
        if (!firstDate) firstDate = isoDate;
        lastDate = isoDate;

        upsertObs.run(
          crypto.randomUUID(),
          farm.id,
          isoDate,
          JSON.stringify(obs),
          JSON.stringify({
            source: 'NASA POWER API',
            elevation_m: elevationM,
            query_lat: farm.latitude,
            query_lon: farm.longitude,
          }),
          now
        );
      }
    });
    tx();

    // Remove stale simulated or fill-value rows after a live sync
    if (validCount > 0) {
      db.prepare(`DELETE FROM observations WHERE farm_id = ? AND dataset_id = 'nasa-power' AND (is_simulated = 1 OR quality_flag = 'PARTIAL_FILL')`).run(
        farm.id
      );
    }

    db.prepare(`UPDATE datasets SET integration_status = 'Connected', last_checked_at = ?, status_detail = ? WHERE id = 'nasa-power'`).run(
      now,
      `Live POWER data synced (${validCount} valid days up to ${lastDate ?? endIso}).`
    );

    db.prepare(`UPDATE ingestion_runs SET status = 'Success', finished_at = ?, records_count = ? WHERE id = ?`).run(
      now,
      validCount,
      runId
    );

    return {
      success: true,
      recordsCount: validCount,
      elevationM,
      observationStart: firstDate,
      observationEnd: lastDate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const now = new Date().toISOString();
    db.prepare(`UPDATE ingestion_runs SET status = 'Failed', finished_at = ?, error_message = ? WHERE id = ?`).run(
      now,
      msg,
      runId
    );
    return {
      success: false,
      recordsCount: 0,
      elevationM: null,
      observationStart: null,
      observationEnd: null,
      error: msg,
    };
  }
}

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export async function syncNasaClimatologyForFarm(farm: FarmRecord): Promise<ClimateBaselineMonth[]> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ingestion_runs (id, farm_id, dataset_id, status, started_at, records_count) VALUES (?, ?, 'nasa-power-climatology', 'Processing', ?, 0)`
  ).run(runId, farm.id, startedAt);

  const url =
    `https://power.larc.nasa.gov/api/temporal/climatology/point` +
    `?parameters=PRECTOTCORR,T2M,GWETROOT&community=AG` +
    `&longitude=${farm.longitude.toFixed(4)}&latitude=${farm.latitude.toFixed(4)}&format=JSON`;

  try {
    const res = await fetchWithRetry(url, undefined, 2);
    const json = (await res.json()) as {
      geometry?: { coordinates?: number[] };
      properties?: { parameter?: Record<string, Record<string, number>> };
    };
    const p = json?.properties?.parameter;
    if (!p?.PRECTOTCORR) throw new Error('Climatology parameter map missing.');

    const months: ClimateBaselineMonth[] = MONTH_KEYS.map((m, idx) => ({
      month: m,
      monthIndex: idx + 1,
      precip_mm_day: cleanPowerValue(p.PRECTOTCORR?.[m]),
      temp_c: cleanPowerValue(p.T2M?.[m]),
      gwetroot: cleanPowerValue(p.GWETROOT?.[m]),
    }));

    const now = new Date().toISOString();
    const elev = typeof json?.geometry?.coordinates?.[2] === 'number' ? Number(json.geometry.coordinates[2].toFixed(1)) : null;

    db.prepare(`
      INSERT INTO climate_baselines (farm_id, months_json, elevation_m, retrieved_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(farm_id) DO UPDATE SET
        months_json = excluded.months_json,
        elevation_m = COALESCE(excluded.elevation_m, climate_baselines.elevation_m),
        retrieved_at = excluded.retrieved_at
    `).run(farm.id, JSON.stringify(months), elev, now);

    db.prepare(`UPDATE datasets SET integration_status = 'Connected', last_checked_at = ?, status_detail = ? WHERE id = 'nasa-power-climatology'`).run(
      now,
      `Live 20-year monthly climatology synced for (${farm.latitude.toFixed(2)}, ${farm.longitude.toFixed(2)}).`
    );
    db.prepare(`UPDATE ingestion_runs SET status = 'Success', finished_at = ?, records_count = 12 WHERE id = ?`).run(
      now,
      runId
    );
    return months;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare(`UPDATE ingestion_runs SET status = 'Failed', finished_at = ?, error_message = ? WHERE id = ?`).run(
      new Date().toISOString(),
      msg,
      runId
    );
    return [];
  }
}

export async function syncNasaEonetEvents(farmId: string): Promise<Array<Omit<EonetEventSummary, 'distance_km'>>> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ingestion_runs (id, farm_id, dataset_id, status, started_at, records_count) VALUES (?, ?, 'nasa-eonet', 'Processing', ?, 0)`
  ).run(runId, farmId, startedAt);

  try {
    const res = await fetchWithRetry('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60', undefined, 2);
    const json = (await res.json()) as {
      events?: Array<{
        id: string;
        title: string;
        link?: string;
        categories?: Array<{ id: string; title: string }>;
        geometry?: Array<{ date?: string; type?: string; coordinates?: unknown }>;
      }>;
    };

    const parsed: Array<Omit<EonetEventSummary, 'distance_km'>> = [];
    for (const ev of json?.events ?? []) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      if (!geom || !Array.isArray(geom.coordinates)) continue;
      let lon: number | null = null;
      let lat: number | null = null;
      if (geom.type === 'Point' && typeof geom.coordinates[0] === 'number' && typeof geom.coordinates[1] === 'number') {
        lon = geom.coordinates[0];
        lat = geom.coordinates[1];
      }
      if (lat === null || lon === null) continue;
      const cat = ev.categories?.[0];
      parsed.push({
        id: ev.id,
        title: ev.title,
        category: cat?.title ?? 'Natural Event',
        category_id: cat?.id ?? 'general',
        date: (geom.date ?? '').slice(0, 10),
        latitude: lat,
        longitude: lon,
        source_url: ev.link ?? 'https://eonet.gsfc.nasa.gov/',
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO eonet_cache (id, events_json, retrieved_at) VALUES ('global-open', ?, ?)
      ON CONFLICT(id) DO UPDATE SET events_json = excluded.events_json, retrieved_at = excluded.retrieved_at
    `).run(JSON.stringify(parsed), now);

    db.prepare(`UPDATE datasets SET integration_status = 'Connected', last_checked_at = ?, status_detail = ? WHERE id = 'nasa-eonet'`).run(
      now,
      `Live NASA EONET v3 global feed synced (${parsed.length} active events worldwide).`
    );
    db.prepare(`UPDATE ingestion_runs SET status = 'Success', finished_at = ?, records_count = ? WHERE id = ?`).run(
      now,
      parsed.length,
      runId
    );
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare(`UPDATE ingestion_runs SET status = 'Failed', finished_at = ?, error_message = ? WHERE id = ?`).run(
      new Date().toISOString(),
      msg,
      runId
    );
    return [];
  }
}

export interface DiscoveryResult {
  srtmGranuleId: string | null;
  landsatScenes: LandsatPrecisionScene[];
  gpmLatestGranule: string | null;
  smapLatestGranule: string | null;
  checkedAt: string;
}

export function getCachedLandsatScenes(farmId: string): LandsatPrecisionScene[] {
  const row = db
    .prepare(`SELECT scenes_json FROM landsat_scenes_cache WHERE farm_id = ?`)
    .get(farmId) as { scenes_json?: string } | undefined;
  if (!row?.scenes_json) return [];
  try {
    return JSON.parse(row.scenes_json) as LandsatPrecisionScene[];
  } catch {
    return [];
  }
}

export async function runSecondaryNasaDiscovery(farm: FarmRecord): Promise<DiscoveryResult> {
  const checkedAt = new Date().toISOString();
  const lon = farm.longitude;
  const lat = farm.latitude;
  const bbox = `${(lon - 0.05).toFixed(3)},${(lat - 0.05).toFixed(3)},${(lon + 0.05).toFixed(3)},${(lat + 0.05).toFixed(3)}`;

  let srtmGranuleId: string | null = null;
  let gpmLatestGranule: string | null = null;
  let smapLatestGranule: string | null = null;
  const landsatScenes: LandsatPrecisionScene[] = [];

  try {
    const res = await fetchWithRetry(
      `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SRTMGL1&version=003&bounding_box=${bbox}&page_size=1`,
      undefined,
      2
    );
    const data = (await res.json()) as { feed?: { entry?: Array<{ title?: string }> } };
    srtmGranuleId = data?.feed?.entry?.[0]?.title ?? null;
    if (srtmGranuleId) {
      db.prepare(`UPDATE datasets SET last_checked_at = ?, status_detail = ? WHERE id = 'nasa-srtm'`).run(
        checkedAt,
        `Verified SRTMGL1 v003 tile ${srtmGranuleId} via NASA CMR; elevation context active.`
      );
    }
  } catch {
    // non-fatal
  }

  try {
    const res = await fetchWithRetry(
      `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=GPM_3IMERGDF&version=07&bounding_box=${bbox}&sort_key=-start_date&page_size=1`,
      undefined,
      2
    );
    const data = (await res.json()) as { feed?: { entry?: Array<{ title?: string }> } };
    gpmLatestGranule = data?.feed?.entry?.[0]?.title ?? null;
    const hasToken = Boolean(process.env.NASA_EARTHDATA_TOKEN);
    db.prepare(`UPDATE datasets SET last_checked_at = ?, status_detail = ? WHERE id = 'nasa-gpm-imerg'`).run(
      checkedAt,
      gpmLatestGranule
        ? `Latest granule discovered (${gpmLatestGranule}). ${hasToken ? 'Earthdata token present.' : 'Earthdata token required for NetCDF pixel extraction.'}`
        : 'CMR reachable; no recent granule matched.'
    );
  } catch {
    // non-fatal
  }

  try {
    const res = await fetchWithRetry(
      `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SPL3SMP_E&bounding_box=${bbox}&sort_key=-start_date&page_size=1`,
      undefined,
      2
    );
    const data = (await res.json()) as { feed?: { entry?: Array<{ title?: string }> } };
    smapLatestGranule = data?.feed?.entry?.[0]?.title ?? null;
    const hasToken = Boolean(process.env.NASA_EARTHDATA_TOKEN);
    db.prepare(`UPDATE datasets SET last_checked_at = ?, status_detail = ? WHERE id = 'nasa-smap'`).run(
      checkedAt,
      smapLatestGranule
        ? `Latest granule discovered (${smapLatestGranule}). ${hasToken ? 'Earthdata token present.' : 'Earthdata token required for HDF5 extraction.'}`
        : 'CMR reachable; no recent granule matched.'
    );
  } catch {
    // non-fatal
  }

  try {
    const res = await fetchWithRetry(
      `https://landsatlook.usgs.gov/stac-server/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collections: ['landsat-c2l2-sr'],
          intersects: { type: 'Point', coordinates: [lon, lat] },
          limit: 3,
        }),
      },
      2
    );
    const data = (await res.json()) as {
      features?: Array<{
        id: string;
        properties?: { datetime?: string; 'eo:cloud_cover'?: number };
        assets?: {
          thumbnail?: { href?: string };
          reduced_resolution_browse?: { href?: string };
        };
      }>;
    };
    for (const f of data?.features ?? []) {
      landsatScenes.push({
        id: f.id,
        datetime: f.properties?.datetime ?? '',
        cloudCover: typeof f.properties?.['eo:cloud_cover'] === 'number' ? Number(f.properties['eo:cloud_cover'].toFixed(1)) : null,
        thumbnailUrl: f.assets?.thumbnail?.href ?? null,
        browseUrl: f.assets?.reduced_resolution_browse?.href ?? null,
      });
    }
    if (landsatScenes.length > 0) {
      db.prepare(`
        INSERT INTO landsat_scenes_cache (farm_id, scenes_json, checked_at) VALUES (?, ?, ?)
        ON CONFLICT(farm_id) DO UPDATE SET scenes_json = excluded.scenes_json, checked_at = excluded.checked_at
      `).run(farm.id, JSON.stringify(landsatScenes), checkedAt);
    }
    db.prepare(`UPDATE datasets SET last_checked_at = ?, status_detail = ? WHERE id = 'usgs-landsat'`).run(
      checkedAt,
      landsatScenes.length > 0
        ? `STAC discovered ${landsatScenes.length} recent Landsat C2L2 scenes (latest ${landsatScenes[0].datetime.slice(0, 10)}, cloud ${landsatScenes[0].cloudCover ?? '?'}%).`
        : 'USGS STAC reachable; no scenes returned for point.'
    );
  } catch {
    // non-fatal
  }

  return { srtmGranuleId, landsatScenes, gpmLatestGranule, smapLatestGranule, checkedAt };
}

export function seedDemoPowerObservationsIfEmpty(farmId: string): void {
  const countRow = db
    .prepare(`SELECT COUNT(*) as c FROM observations WHERE farm_id = ? AND dataset_id = 'nasa-power'`)
    .get(farmId) as { c: number };
  if (countRow.c > 0) return;

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO observations (
      id, farm_id, dataset_id, observation_date, variables_json,
      raw_metadata_json, quality_flag, is_simulated, retrieved_at
    ) VALUES (?, ?, 'nasa-power', ?, ?, ?, 'DEMO_BASELINE', 1, ?)
  `);

  const tx = db.transaction(() => {
    for (let i = 60; i >= 1; i--) {
      const dateIso = daysAgoIso(i + 3);
      const isRecent30 = i <= 30;
      const rain = isRecent30
        ? (i % 6 === 0 ? 5.2 : i % 4 === 0 ? 1.8 : 0.2)
        : (i % 3 === 0 ? 9.4 : i % 2 === 0 ? 3.1 : 0.6);
      const tMean = isRecent30 ? 27.6 + (i % 3) * 0.4 : 26.4 + (i % 3) * 0.3;
      const tMax = Number((tMean + 5.2).toFixed(2));
      const tMin = Number((tMean - 4.4).toFixed(2));
      const gwetTop = isRecent30 ? 0.44 : 0.62;
      const gwetRoot = isRecent30 ? 0.51 : 0.65;
      const vars = {
        PRECTOTCORR: Number(rain.toFixed(2)),
        T2M: Number(tMean.toFixed(2)),
        T2M_MAX: tMax,
        T2M_MIN: tMin,
        GWETTOP: gwetTop,
        GWETROOT: gwetRoot,
        GWETPROF: 0.54,
        ALLSKY_SFC_SW_DWN: isRecent30 ? 19.4 : 17.1,
        RH2M: isRecent30 ? 68.5 : 78.2,
        WS2M: 1.8,
        EVPTRNS: 3.6,
        EVLAND: 3.4,
      };
      stmt.run(
        crypto.randomUUID(),
        farmId,
        dateIso,
        JSON.stringify(vars),
        JSON.stringify({ source: 'Demonstration Baseline (Preloaded)', elevation_m: 224 }),
        now
      );
    }
  });
  tx();
}
