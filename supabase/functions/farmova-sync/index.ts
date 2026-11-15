// Supabase Edge Function: farmova-sync
// Deploy with: supabase functions deploy farmova-sync
// Configure secrets:
//   supabase secrets set METEOMATICS_USERNAME=... METEOMATICS_PASSWORD=...

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SyncRequest {
  farmId?: string;
  latitude: number;
  longitude: number;
  includeMeteomatics?: boolean;
  includeNasaEonet?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as SyncRequest;
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return new Response(
        JSON.stringify({ error: 'Valid latitude and longitude are required.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const end = new Date(now.getTime() + 72 * 3600_000);
    const startIso = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const endIso = end.toISOString().replace(/\.\d{3}Z$/, 'Z');

    const result: Record<string, unknown> = {
      edgeRuntime: 'supabase-deno-edge',
      farmId: body.farmId ?? null,
      coordinates: { latitude: lat, longitude: lon },
      executedAt: now.toISOString(),
    };

    // 1. Meteomatics Live Weather API (from Supabase Edge Secrets)
    if (body.includeMeteomatics !== false) {
      const mmUser = Deno.env.get('METEOMATICS_USERNAME');
      const mmPass = Deno.env.get('METEOMATICS_PASSWORD');
      if (mmUser && mmPass) {
        const params = 't_2m:C,precip_1h:mm,relative_humidity_2m:p,wind_speed_10m:ms,volumetric_soil_water_-5cm:m3m3,weather_symbol_1h:idx';
        const mmUrl = `https://api.meteomatics.com/${startIso}--${endIso}:PT6H/${params}/${lat.toFixed(5)},${lon.toFixed(5)}/json`;
        const mmRes = await fetch(mmUrl, {
          headers: {
            Authorization: `Basic ${btoa(`${mmUser}:${mmPass}`)}`,
          },
        });
        if (mmRes.ok) {
          result.meteomatics = { status: 'connected', data: await mmRes.json() };
        } else {
          result.meteomatics = { status: 'error', httpStatus: mmRes.status };
        }
      } else {
        result.meteomatics = {
          status: 'credentials_missing',
          message: 'Set METEOMATICS_USERNAME and METEOMATICS_PASSWORD in Supabase Edge Secrets.',
        };
      }
    }

    // 2. NASA EONET v3 Live Natural Hazard Check
    if (body.includeNasaEonet !== false) {
      const eonetRes = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25');
      if (eonetRes.ok) {
        const eonetJson = (await eonetRes.json()) as { events?: Array<{ id: string; title: string }> };
        result.nasaEonet = {
          status: 'connected',
          openEventsCount: eonetJson.events?.length ?? 0,
        };
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Edge sync error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
