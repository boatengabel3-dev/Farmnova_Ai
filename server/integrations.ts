import crypto from 'node:crypto';
import { db } from './db.ts';
import type {
  FarmRecord,
  MeteomaticsSlot,
  MeteomaticsWeatherPayload,
  SupabaseEdgeSyncResult,
} from './types.ts';

function resolveSupabaseBaseUrl(): string | null {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return raw ? raw.trim().replace(/\/+$/, '') : null;
}

function resolveSupabaseApiKey(): string | null {
  const raw = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return raw ? raw.trim() : null;
}

function resolveEdgeUrl(): string | null {
  if (process.env.SUPABASE_EDGE_FUNCTION_URL) {
    return process.env.SUPABASE_EDGE_FUNCTION_URL.trim();
  }
  const base = resolveSupabaseBaseUrl();
  if (base) {
    return `${base}/functions/v1/farmova-sync`;
  }
  return null;
}

export interface IntegrationStatusSummary {
  meteomaticsConfigured: boolean;
  supabaseEdgeConfigured: boolean;
  supabaseEdgeUrl: string | null;
  nasaEarthdataConfigured: boolean;
  khayaConfigured: boolean;
  geminiConfigured: boolean;
  utcDate: string;
}

export function getIntegrationStatuses(): IntegrationStatusSummary {
  const edgeUrl = resolveEdgeUrl();
  return {
    meteomaticsConfigured: Boolean(process.env.METEOMATICS_USERNAME && process.env.METEOMATICS_PASSWORD),
    supabaseEdgeConfigured: Boolean(edgeUrl),
    supabaseEdgeUrl: edgeUrl,
    nasaEarthdataConfigured: Boolean(process.env.NASA_EARTHDATA_TOKEN),
    khayaConfigured: Boolean(process.env.GHANANLP_API_KEY || process.env.KHAYA_API_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    utcDate: new Date().toISOString().slice(0, 10),
  };
}

export function getCachedMeteomaticsWeather(farmId: string): MeteomaticsWeatherPayload {
  const row = db
    .prepare(`SELECT payload_json, retrieved_at FROM meteomatics_cache WHERE farm_id = ?`)
    .get(farmId) as { payload_json?: string; retrieved_at?: string } | undefined;

  if (row?.payload_json) {
    try {
      return JSON.parse(row.payload_json) as MeteomaticsWeatherPayload;
    } catch {
      // fall through
    }
  }

  const configured = Boolean(process.env.METEOMATICS_USERNAME && process.env.METEOMATICS_PASSWORD);
  return {
    status: configured ? 'error' : 'credentials_missing',
    retrieved_at: new Date().toISOString(),
    current: null,
    forecast_slots: [],
    next_72h_precip_mm: null,
    message: configured
      ? 'Meteomatics credentials ready. Click Sync Live Weather to fetch the latest 72h 6-hourly forecast.'
      : 'Meteomatics API requires METEOMATICS_USERNAME and METEOMATICS_PASSWORD on the server (or in Supabase Edge Secrets).',
  };
}

interface MeteomaticsApiResponse {
  data?: Array<{
    parameter: string;
    coordinates?: Array<{
      dates?: Array<{ date: string; value: number }>;
    }>;
  }>;
}

function parseMeteomaticsJson(json: MeteomaticsApiResponse, retrievedAt: string): MeteomaticsWeatherPayload {
  const byDate = new Map<string, MeteomaticsSlot>();
  const ensureSlot = (dt: string): MeteomaticsSlot => {
    let slot = byDate.get(dt);
    if (!slot) {
      slot = {
        valid_date: dt,
        temp_c: null,
        precip_mm: null,
        humidity_pct: null,
        wind_ms: null,
        soil_water_5cm_m3m3: null,
        weather_symbol: null,
      };
      byDate.set(dt, slot);
    }
    return slot;
  };

  for (const paramBlock of json.data ?? []) {
    const dates = paramBlock.coordinates?.[0]?.dates ?? [];
    for (const pt of dates) {
      const slot = ensureSlot(pt.date);
      const val = typeof pt.value === 'number' && Number.isFinite(pt.value) && pt.value > -900 ? Number(pt.value.toFixed(2)) : null;
      if (paramBlock.parameter.startsWith('t_2m')) slot.temp_c = val;
      else if (paramBlock.parameter.startsWith('precip_1h')) slot.precip_mm = val;
      else if (paramBlock.parameter.startsWith('relative_humidity_2m')) slot.humidity_pct = val;
      else if (paramBlock.parameter.startsWith('wind_speed_10m')) slot.wind_ms = val;
      else if (paramBlock.parameter.startsWith('volumetric_soil_water')) slot.soil_water_5cm_m3m3 = val;
      else if (paramBlock.parameter.startsWith('weather_symbol')) slot.weather_symbol = val;
    }
  }

  const slots = Array.from(byDate.values()).sort((a, b) => a.valid_date.localeCompare(b.valid_date));
  const totalPrecip = slots.reduce((sum, s) => sum + (s.precip_mm ?? 0), 0);

  return {
    status: 'connected',
    retrieved_at: retrievedAt,
    current: slots[0] ?? null,
    forecast_slots: slots.slice(0, 12),
    next_72h_precip_mm: Number(totalPrecip.toFixed(1)),
    message: `Live Meteomatics forecast synced (${slots.length} 6-hourly slots from ${slots[0]?.valid_date.slice(0, 16) ?? ''} UTC).`,
  };
}

export async function syncMeteomaticsWeatherForFarm(farm: FarmRecord): Promise<MeteomaticsWeatherPayload> {
  const user = process.env.METEOMATICS_USERNAME?.trim();
  const pass = process.env.METEOMATICS_PASSWORD?.trim();
  const nowIso = new Date().toISOString();

  if (!user || !pass) {
    const missingPayload: MeteomaticsWeatherPayload = {
      status: 'credentials_missing',
      retrieved_at: nowIso,
      current: null,
      forecast_slots: [],
      next_72h_precip_mm: null,
      message: 'Meteomatics API requires METEOMATICS_USERNAME and METEOMATICS_PASSWORD in server environment variables.',
    };
    db.prepare(`UPDATE datasets SET integration_status = 'Credentials Required', last_checked_at = ?, status_detail = ? WHERE id = 'meteomatics-live'`).run(
      nowIso,
      missingPayload.message
    );
    return missingPayload;
  }

  const runId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO ingestion_runs (id, farm_id, dataset_id, status, started_at, records_count) VALUES (?, ?, 'meteomatics-live', 'Processing', ?, 0)`
  ).run(runId, farm.id, nowIso);

  try {
    const startDt = new Date();
    const endDt = new Date(startDt.getTime() + 72 * 3600_000);
    const startStr = startDt.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const endStr = endDt.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const params = 't_2m:C,precip_1h:mm,relative_humidity_2m:p,wind_speed_10m:ms,volumetric_soil_water_-5cm:m3m3,weather_symbol_1h:idx';
    const url = `https://api.meteomatics.com/${startStr}--${endStr}:PT6H/${params}/${farm.latitude.toFixed(5)},${farm.longitude.toFixed(5)}/json`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14_000);
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Meteomatics HTTP ${res.status}`);
    }

    const rawJson = (await res.json()) as MeteomaticsApiResponse;
    const finishedAt = new Date().toISOString();
    const payload = parseMeteomaticsJson(rawJson, finishedAt);

    db.prepare(`
      INSERT INTO meteomatics_cache (farm_id, payload_json, retrieved_at) VALUES (?, ?, ?)
      ON CONFLICT(farm_id) DO UPDATE SET payload_json = excluded.payload_json, retrieved_at = excluded.retrieved_at
    `).run(farm.id, JSON.stringify(payload), finishedAt);

    db.prepare(`UPDATE datasets SET integration_status = 'Connected', last_checked_at = ?, status_detail = ? WHERE id = 'meteomatics-live'`).run(
      finishedAt,
      payload.message
    );
    db.prepare(`UPDATE ingestion_runs SET status = 'Success', finished_at = ?, records_count = ? WHERE id = ?`).run(
      finishedAt,
      payload.forecast_slots.length,
      runId
    );
    return payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date().toISOString();
    db.prepare(`UPDATE datasets SET integration_status = 'Unavailable', last_checked_at = ?, status_detail = ? WHERE id = 'meteomatics-live'`).run(
      finishedAt,
      `Meteomatics sync error: ${msg}`
    );
    db.prepare(`UPDATE ingestion_runs SET status = 'Failed', finished_at = ?, error_message = ? WHERE id = ?`).run(
      finishedAt,
      msg,
      runId
    );
    return {
      status: 'error',
      retrieved_at: finishedAt,
      current: null,
      forecast_slots: [],
      next_72h_precip_mm: null,
      message: `Unable to fetch Meteomatics forecast (${msg}).`,
    };
  }
}

export async function invokeSupabaseEdgeSync(farm: FarmRecord): Promise<SupabaseEdgeSyncResult> {
  const edgeUrl = resolveEdgeUrl();
  const baseUrl = resolveSupabaseBaseUrl();
  const apiKey = resolveSupabaseApiKey();
  const executedAt = new Date().toISOString();

  if (!edgeUrl) {
    const msg =
      'Supabase Edge Function URL not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_EDGE_FUNCTION_URL).';
    db.prepare(`UPDATE datasets SET integration_status = 'Credentials Required', last_checked_at = ?, status_detail = ? WHERE id = 'supabase-edge'`).run(
      executedAt,
      msg
    );
    return {
      configured: false,
      edge_url: null,
      status: 'not_configured',
      latency_ms: null,
      executed_at: executedAt,
      message: msg,
      edge_payload: null,
    };
  }

  const runId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO ingestion_runs (id, farm_id, dataset_id, status, started_at, records_count) VALUES (?, ?, 'supabase-edge', 'Processing', ?, 0)`
  ).run(runId, farm.id, executedAt);

  const startedMs = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14_000);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers.apikey = apiKey;
      // Legacy JWT anon keys use Authorization Bearer; sb_publishable_* keys authenticate via apikey header
      if (apiKey.startsWith('eyJ')) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
    }

    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude,
        includeMeteomatics: true,
        includeNasaEonet: true,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startedMs;
    const finishedAt = new Date().toISOString();
    const edgeJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      if (res.status === 404) {
        const refMatch = baseUrl?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
        const refHint = refMatch ? ` --project-ref ${refMatch[1]}` : '';
        throw new Error(
          `Supabase gateway reachable (${baseUrl}), but Edge Function "farmova-sync" is not deployed yet (HTTP 404). Deploy via: supabase functions deploy farmova-sync${refHint} --no-verify-jwt`
        );
      }
      throw new Error(`Edge HTTP ${res.status}: ${String(edgeJson.message ?? edgeJson.error ?? 'Invocation failed')}`);
    }

    // If Edge Function returned live Meteomatics data, cache it for this farm as well
    const mmBlock = edgeJson.meteomatics as { status?: string; data?: MeteomaticsApiResponse } | undefined;
    if (mmBlock?.status === 'connected' && mmBlock.data) {
      const parsedMm = parseMeteomaticsJson(mmBlock.data, finishedAt);
      db.prepare(`
        INSERT INTO meteomatics_cache (farm_id, payload_json, retrieved_at) VALUES (?, ?, ?)
        ON CONFLICT(farm_id) DO UPDATE SET payload_json = excluded.payload_json, retrieved_at = excluded.retrieved_at
      `).run(farm.id, JSON.stringify(parsedMm), finishedAt);
    }

    db.prepare(`UPDATE datasets SET integration_status = 'Connected', last_checked_at = ?, status_detail = ? WHERE id = 'supabase-edge'`).run(
      finishedAt,
      `Invoked farmova-sync Edge Function in ${latencyMs} ms.`
    );
    db.prepare(`UPDATE ingestion_runs SET status = 'Success', finished_at = ?, records_count = 1 WHERE id = ?`).run(
      finishedAt,
      runId
    );

    return {
      configured: true,
      edge_url: edgeUrl,
      status: 'invoked',
      latency_ms: latencyMs,
      executed_at: finishedAt,
      message: `Supabase Edge Function farmova-sync responded in ${latencyMs} ms.`,
      edge_payload: edgeJson,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date().toISOString();
    db.prepare(`UPDATE datasets SET integration_status = 'Unavailable', last_checked_at = ?, status_detail = ? WHERE id = 'supabase-edge'`).run(
      finishedAt,
      `Edge invocation error: ${msg}`
    );
    db.prepare(`UPDATE ingestion_runs SET status = 'Failed', finished_at = ?, error_message = ? WHERE id = ?`).run(
      finishedAt,
      msg,
      runId
    );
    return {
      configured: true,
      edge_url: edgeUrl,
      status: 'error',
      latency_ms: Date.now() - startedMs,
      executed_at: finishedAt,
      message: `Supabase Edge Function error: ${msg}`,
      edge_payload: null,
    };
  }
}
