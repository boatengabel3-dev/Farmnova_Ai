import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CloudRain,
  Database,
  Download,
  ExternalLink,
  FileText,
  Flame,
  Layers,
  RefreshCw,
  Satellite,
  Server,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchDatasets,
  fetchFarmIntelligence,
  fetchFarms,
  invokeEdgeSync,
  syncMeteomatics,
  syncNasaForFarm,
} from '../lib/api';
import { formatCalendarDate } from '../lib/date';
import type {
  ClimateBaselineMonth,
  DailyObservation,
  DatasetProvenance,
  DiscoveryResult,
  FarmIndicators,
  FarmRecord,
  GibsLayerSpec,
  IngestionRunRecord,
  IntegrationStatusSummary,
  LandsatPrecisionScene,
  LanguageCapabilities,
  MeteomaticsWeatherPayload,
  ProgressLogRecord,
  RecommendationRecord,
  SeasonCycleRecord,
  SoilMoistureOutlook,
  SupabaseEdgeSyncResult,
} from '../types';
import { FarmMap } from './FarmMap';

interface TechnicalWorkspaceProps {
  gibsLayers: GibsLayerSpec[];
  langCapabilities: LanguageCapabilities | null;
  initialFarmId?: string;
}

export const TechnicalWorkspace: React.FC<TechnicalWorkspaceProps> = ({
  gibsLayers,
  langCapabilities,
  initialFarmId,
}) => {
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(initialFarmId ?? 'demo-ejura-farm');
  const [farmDetail, setFarmDetail] = useState<FarmRecord | null>(null);
  const [indicators, setIndicators] = useState<FarmIndicators | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationRecord | null>(null);
  const [observations, setObservations] = useState<DailyObservation[]>([]);
  const [climatology, setClimatology] = useState<ClimateBaselineMonth[]>([]);
  const [outlook, setOutlook] = useState<SoilMoistureOutlook | null>(null);
  const [seasons, setSeasons] = useState<SeasonCycleRecord[]>([]);
  const [progressLogs, setProgressLogs] = useState<ProgressLogRecord[]>([]);
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRunRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetProvenance[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [landsatScenes, setLandsatScenes] = useState<LandsatPrecisionScene[]>([]);
  const [meteomatics, setMeteomatics] = useState<MeteomaticsWeatherPayload | null>(null);
  const [edgeSyncResult, setEdgeSyncResult] = useState<SupabaseEdgeSyncResult | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatusSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mmSyncing, setMmSyncing] = useState(false);
  const [edgeSyncing, setEdgeSyncing] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchFarms('all'), fetchDatasets()])
      .then(([allFarms, ds]) => {
        setFarms(allFarms);
        setDatasets(ds);
        const target = allFarms.find((f) => f.id === selectedFarmId) ?? allFarms[0];
        if (target) setSelectedFarmId(target.id);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedFarmId) return;
    fetchFarmIntelligence(selectedFarmId, true)
      .then((res) => {
        setFarmDetail(res.farm);
        setIndicators(res.indicators);
        setRecommendation(res.recommendation);
        setObservations(res.observations);
        setClimatology(res.climatology ?? []);
        setOutlook(res.outlook ?? null);
        setSeasons(res.seasons ?? []);
        setProgressLogs(res.progressLogs ?? []);
        setIngestionRuns(res.ingestionRuns);
        setMeteomatics(res.meteomatics ?? null);
        setLandsatScenes(res.landsatScenes ?? []);
        setIntegrations(res.integrations ?? null);
      })
      .catch(() => undefined);
  }, [selectedFarmId]);

  const handleSyncNasa = async () => {
    if (!selectedFarmId) return;
    setSyncing(true);
    try {
      const res = await syncNasaForFarm(selectedFarmId, true);
      setIndicators(res.indicators);
      setRecommendation(res.recommendation);
      setObservations(res.observations);
      setClimatology(res.climatology ?? []);
      setOutlook(res.outlook ?? null);
      setSeasons(res.seasons ?? []);
      setIngestionRuns(res.ingestionRuns);
      setDatasets(res.datasets);
      setDiscovery(res.discovery);
      setLandsatScenes(res.landsatScenes ?? []);
      setMeteomatics(res.meteomatics ?? null);
      setIntegrations(res.integrations ?? null);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncMeteomatics = async () => {
    if (!selectedFarmId) return;
    setMmSyncing(true);
    try {
      const res = await syncMeteomatics(selectedFarmId, true);
      setMeteomatics(res.meteomatics);
      setDatasets(res.datasets);
      setIngestionRuns(res.ingestionRuns);
      setIntegrations(res.integrations);
    } finally {
      setMmSyncing(false);
    }
  };

  const handleInvokeEdge = async () => {
    if (!selectedFarmId) return;
    setEdgeSyncing(true);
    try {
      const res = await invokeEdgeSync(selectedFarmId, true);
      setEdgeSyncResult(res.edgeSync);
      setMeteomatics(res.meteomatics);
      setDatasets(res.datasets);
      setIngestionRuns(res.ingestionRuns);
      setIntegrations(res.integrations);
    } finally {
      setEdgeSyncing(false);
    }
  };

  const handleExportJson = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      platform: 'Farmova AI Technical Intelligence Report',
      nasaAttribution:
        'Data sourced from NASA POWER (Daily & 20-Year Climatology), NASA GIBS, NASA EONET v3, NASA CMR, and USGS/NASA Landsat STAC. NASA is a scientific data source and does not endorse or sponsor Farmova AI.',
      farm: farmDetail,
      indicators,
      outlook,
      climatology,
      recommendation,
      seasons,
      progressLogs,
      discovery,
      datasets,
      observationsCount: observations.length,
      recentObservations: observations.slice(-30),
      ingestionRuns,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farmova-report-${selectedFarmId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = ['date', 'PRECTOTCORR_mm', 'T2M_C', 'T2M_MAX_C', 'GWETTOP', 'GWETROOT', 'ALLSKY_SFC_SW_DWN', 'RH2M', 'EVLAND', 'is_simulated', 'quality_flag'];
    const lines = [
      headers.join(','),
      ...observations.map((o) =>
        [
          o.date,
          o.PRECTOTCORR ?? '',
          o.T2M ?? '',
          o.T2M_MAX ?? '',
          o.GWETTOP ?? '',
          o.GWETROOT ?? '',
          o.ALLSKY_SFC_SW_DWN ?? '',
          o.RH2M ?? '',
          o.EVLAND ?? '',
          o.is_simulated ? '1' : '0',
          o.quality_flag,
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farmova-nasa-power-${selectedFarmId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartObs = useMemo(() => observations.slice(-30), [observations]);
  const maxRain = useMemo(
    () => Math.max(10, ...chartObs.map((o) => o.PRECTOTCORR ?? 0)),
    [chartObs]
  );
  const maxClimRain = useMemo(
    () => Math.max(4, ...climatology.map((c) => c.precip_mm_day ?? 0)),
    [climatology]
  );

  const statusTone = (status: string) => {
    if (status === 'Connected' || status === 'Imagery Active' || status === 'Success' || status === 'Low' || status === 'invoked') return 'text-emerald-700';
    if (status === 'Metadata Discovery' || status === 'Discovery Only' || status === 'Processing' || status === 'Moderate' || status === 'Credentials Required' || status === 'not_configured') return 'text-amber-700';
    if (status === 'Failed' || status === 'Unavailable' || status === 'Elevated' || status === 'error') return 'text-rose-700';
    return 'text-slate-500';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-sm text-slate-600">
        Loading Technical Intelligence Workspace...
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Telemetry & Action Strip */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono-tabular uppercase tracking-wider text-slate-500">
              Technical Intelligence Workspace · Global NASA Earth-Observation Pipeline
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900"
                aria-label="Select registered farm"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({[f.community || f.district, f.country].filter(Boolean).join(', ') || 'Global'})
                  </option>
                ))}
              </select>
              {farmDetail && (
                <span className="text-xs font-mono-tabular text-slate-600">
                  {farmDetail.latitude.toFixed(5)}°, {farmDetail.longitude.toFixed(5)}°
                  {' · '}
                  {farmDetail.country || 'Global'}
                  {' · '}
                  Source: {farmDetail.location_source.toUpperCase()}
                  {farmDetail.gps_accuracy_m ? ` (±${farmDetail.gps_accuracy_m} m)` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncNasa}
              disabled={syncing}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1F5A2E] text-white text-xs font-semibold hover:bg-[#194A25] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing NASA APIs...' : 'Run Live NASA Sync'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export JSON Report</span>
            </button>
          </div>
        </div>

        {/* Environmental Indicators Summary Row */}
        {indicators && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-500">Data Mode</div>
              <div className="text-sm font-bold mt-1 text-slate-900">
                {indicators.data_source_mode === 'live_nasa_power'
                  ? 'Live NASA POWER'
                  : indicators.data_source_mode === 'demonstration_cache'
                  ? 'Demo Baseline'
                  : 'Unavailable'}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                {indicators.days_count} daily obs
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-500">30d Rainfall</div>
              <div className="text-xl font-bold font-mono-tabular mt-1">
                {indicators.rainfall_30d_mm !== null ? `${indicators.rainfall_30d_mm} mm` : 'N/A'}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                Clim Norm: {outlook?.climate_rainfall_vs_normal_pct !== null && outlook?.climate_rainfall_vs_normal_pct !== undefined
                  ? `${outlook.climate_rainfall_vs_normal_pct > 0 ? '+' : ''}${outlook.climate_rainfall_vs_normal_pct}%`
                  : 'N/A'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-500">Dry Spell Run</div>
              <div className="text-xl font-bold font-mono-tabular mt-1">
                {indicators.dry_spell_days !== null ? `${indicators.dry_spell_days} d` : 'N/A'}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                &lt; 1.0 mm/day
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-500">Mean / Max T2M</div>
              <div className="text-xl font-bold font-mono-tabular mt-1">
                {indicators.mean_temp_c !== null ? `${indicators.mean_temp_c}°C` : 'N/A'}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                Max {indicators.max_temp_c ?? 'N/A'}°C · {indicators.heat_stress_days ?? 0}d ≥34°C
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-500">Soil Moisture 14d</div>
              <div className="text-xl font-bold font-mono-tabular mt-1">
                {outlook?.projected_14d_wetness !== null && outlook?.projected_14d_wetness !== undefined
                  ? `${Math.round(outlook.projected_14d_wetness * 100)}%`
                  : indicators.root_wetness_index !== null
                  ? `${Math.round(indicators.root_wetness_index * 100)}%`
                  : 'N/A'}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                Now: {indicators.root_wetness_index?.toFixed(2) ?? 'N/A'} ({outlook?.trend_direction ?? '—'})
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-500">Elevation</div>
              <div className="text-xl font-bold font-mono-tabular mt-1">
                {indicators.elevation_m !== null ? `${indicators.elevation_m} m` : 'N/A'}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 mt-1">
                SRTMGL1 / POWER
              </div>
            </div>
          </div>
        )}

        {/* Asymmetric Split: NASA GIBS Map + Time Series Chart */}
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Satellite className="w-4 h-4 text-[#1F5A2E]" />
                <span>Spatial Plot & NASA GIBS Imagery Overlays</span>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {farmDetail?.boundary_geojson
                  ? `${farmDetail.boundary_geojson.coordinates[0].length - 1} vertices · ${farmDetail.area_hectares} ha`
                  : 'Centroid Point Only'}
              </span>
            </div>

            {farmDetail && (
              <FarmMap
                latitude={farmDetail.latitude}
                longitude={farmDetail.longitude}
                gpsAccuracyM={farmDetail.gps_accuracy_m}
                boundary={farmDetail.boundary_geojson}
                gibsLayers={gibsLayers}
                showLayerPicker
                heightClass="h-80"
              />
            )}
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  30-Day NASA POWER Daily Time Series (~50 km grid)
                </h2>
                <p className="text-xs text-slate-500">
                  Bars: PRECTOTCORR (mm/day) · Line: Root-zone wetness GWETROOT (0–100%)
                </p>
              </div>
              {hoverIdx !== null && chartObs[hoverIdx] && (
                <div className="text-xs font-mono-tabular text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                  {chartObs[hoverIdx].date} · Rain {chartObs[hoverIdx].PRECTOTCORR ?? '—'}mm · Wetness{' '}
                  {chartObs[hoverIdx].GWETROOT !== null ? `${Math.round(chartObs[hoverIdx].GWETROOT! * 100)}%` : '—'} ·{' '}
                  {chartObs[hoverIdx].T2M ?? '—'}°C
                </div>
              )}
            </div>

            {chartObs.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <svg viewBox="0 0 600 230" className="w-full h-64" role="img" aria-label="NASA POWER Rainfall and Soil Wetness Chart">
                  <line x1="36" y1="190" x2="588" y2="190" stroke="#CBD5E1" strokeWidth="1" />
                  <line x1="36" y1="20" x2="36" y2="190" stroke="#CBD5E1" strokeWidth="1" />
                  <text x="6" y="28" fontSize="10" fill="#64748B" fontFamily="monospace">{Math.round(maxRain)}mm</text>
                  <text x="12" y="190" fontSize="10" fill="#64748B" fontFamily="monospace">0</text>

                  {chartObs.map((o, idx) => {
                    const barW = 540 / chartObs.length - 3;
                    const x = 42 + idx * (540 / chartObs.length);
                    const rain = o.PRECTOTCORR ?? 0;
                    const h = Math.max(1, (rain / maxRain) * 160);
                    return (
                      <g key={o.date} onMouseEnter={() => setHoverIdx(idx)} onMouseLeave={() => setHoverIdx(null)}>
                        <rect
                          x={x}
                          y={190 - h}
                          width={Math.max(4, barW)}
                          height={h}
                          rx="2"
                          fill={o.is_simulated ? '#94A3B8' : '#2563EB'}
                          opacity={hoverIdx === idx ? 1 : 0.72}
                        />
                        {idx % 6 === 0 && (
                          <text x={x} y="208" fontSize="9" fill="#64748B" fontFamily="monospace">
                            {o.date.slice(5)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  <polyline
                    fill="none"
                    stroke="#1F5A2E"
                    strokeWidth="2.5"
                    points={chartObs
                      .map((o, idx) => {
                        const x = 42 + idx * (540 / chartObs.length) + 6;
                        const wet = o.GWETROOT ?? 0.5;
                        const y = 190 - wet * 160;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                </svg>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-sm text-slate-500">
                No NASA POWER observations recorded for this farm yet. Click "Run Live NASA Sync".
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
              <span>Window: {formatCalendarDate(indicators?.observation_start)} to {formatCalendarDate(indicators?.observation_end)}</span>
              <span>Khaya AI Status: {langCapabilities?.khayaConfigured ? 'Key Active' : 'Not configured (Fallback Active)'}</span>
            </div>
          </div>
        </div>

        {/* Meteomatics Live Weather + Supabase Edge Function + Landsat 30m Scenes */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Meteomatics Live Weather & Supabase Edge Card */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-[#1F5A2E]" />
                <h2 className="text-sm font-bold text-slate-900">
                  Meteomatics Live Weather & Supabase Edge Sync
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncMeteomatics}
                  disabled={mmSyncing}
                  className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${mmSyncing ? 'animate-spin' : ''}`} />
                  <span>{mmSyncing ? 'Syncing...' : 'Sync Meteomatics'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleInvokeEdge}
                  disabled={edgeSyncing}
                  className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>{edgeSyncing ? 'Invoking...' : 'Run Edge Sync'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Meteomatics REST API Status</span>
                <span className={`font-mono-tabular font-bold ${meteomatics?.status === 'connected' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {meteomatics?.status === 'connected' ? 'CONNECTED' : meteomatics?.status === 'credentials_missing' ? 'CREDENTIALS REQUIRED' : 'STANDBY'}
                </span>
              </div>
              <p className="text-slate-600">{meteomatics?.message}</p>
              {meteomatics?.status === 'connected' && meteomatics.forecast_slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono-tabular">
                  {meteomatics.forecast_slots.slice(0, 3).map((s) => (
                    <div key={s.valid_date} className="p-2 rounded bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500">{s.valid_date.slice(5, 16).replace('T', ' ')}Z</div>
                      <div className="font-bold text-slate-900">{s.temp_c ?? '—'}°C · {s.precip_mm ?? 0}mm</div>
                      <div className="text-[10px] text-slate-600">Soil: {s.soil_water_5cm_m3m3 ?? '—'} m³/m³</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Supabase Edge Function (farmova-sync)</span>
                <span className={`font-mono-tabular font-bold ${integrations?.supabaseEdgeConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {integrations?.supabaseEdgeConfigured ? 'ENDPOINT CONFIGURED' : 'NOT CONFIGURED'}
                </span>
              </div>
              <div className="text-slate-600">
                {edgeSyncResult
                  ? `${edgeSyncResult.message}${edgeSyncResult.latency_ms !== null ? ` (${edgeSyncResult.latency_ms} ms)` : ''}`
                  : integrations?.supabaseEdgeConfigured
                  ? `Ready at ${integrations.supabaseEdgeUrl}`
                  : 'Deploy supabase/functions/farmova-sync to Supabase and set SUPABASE_URL + SUPABASE_ANON_KEY to execute low-latency edge ingestion.'}
              </div>
            </div>
          </div>

          {/* USGS/NASA Landsat C2L2 SR 30m Scene Thumbnails */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-[#1F5A2E]" />
                <h2 className="text-sm font-bold text-slate-900">
                  USGS/NASA Landsat 8/9 C2L2 30m Precision Scenes
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {landsatScenes.length} scene(s) cached
              </span>
            </div>

            {landsatScenes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No Landsat STAC scenes cached yet for this plot. Click "Run Live NASA Sync" above to query USGS LandsatLook STAC.
              </div>
            ) : (
              <div className="space-y-2.5">
                {landsatScenes.slice(0, 2).map((sc) => (
                  <div key={sc.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3 text-xs">
                    {sc.thumbnailUrl && (
                      <img
                        src={sc.thumbnailUrl}
                        alt={sc.id}
                        className="w-16 h-16 rounded object-cover border border-slate-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="font-mono-tabular font-bold text-slate-900 truncate">{sc.id}</div>
                      <div className="font-mono-tabular text-slate-600">
                        Acquired: {formatCalendarDate(sc.datetime)} ({sc.datetime.slice(11, 19)} UTC) · Cloud: {sc.cloudCover ?? '?'}%
                      </div>
                      {sc.browseUrl && (
                        <a
                          href={sc.browseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#1F5A2E] font-semibold hover:underline"
                        >
                          <span>Full Browse Image</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* NASA 20-Year Climatology & Disaster Risk / EONET Panel */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* 12-Month NASA Climatology Baseline & Soil Moisture Model */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                NASA POWER 20-Year Monthly Climatology & Water Balance
              </h2>
              <span className="text-xs font-mono-tabular text-slate-500">
                Net Balance: {outlook?.net_water_balance_mm_day ?? 'N/A'} mm/day
              </span>
            </div>

            {climatology.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-1.5 items-end h-32 pt-4 border-b border-slate-200">
                  {climatology.map((c) => {
                    const pct = Math.max(6, Math.round(((c.precip_mm_day ?? 0) / maxClimRain) * 100));
                    const isCurrent = c.monthIndex === new Date().getUTCMonth() + 1;
                    return (
                      <div key={c.month} className="flex flex-col items-center gap-1 h-full justify-end">
                        <div className="text-[9px] font-mono-tabular text-slate-500">
                          {c.precip_mm_day !== null ? c.precip_mm_day.toFixed(1) : '—'}
                        </div>
                        <div
                          className={`w-full rounded-t ${isCurrent ? 'bg-[#1F5A2E]' : 'bg-slate-300'}`}
                          style={{ height: `${pct}%` }}
                          title={`${c.month}: ${c.precip_mm_day ?? 'N/A'} mm/day, ${c.temp_c ?? 'N/A'}°C`}
                        />
                        <div className={`text-[10px] font-mono-tabular ${isCurrent ? 'font-bold text-[#1F5A2E]' : 'text-slate-500'}`}>
                          {c.month}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {outlook?.methodology_note}
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">
                Climatology normal not synced yet. Click "Run Live NASA Sync" above.
              </div>
            )}
          </div>

          {/* NASA EONET & Disaster Risk Matrix */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#A2461F]" />
                <h2 className="text-sm font-bold text-slate-900">
                  Disaster Risk Assessment & NASA EONET v3 Feed
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {outlook?.nearby_eonet_events.length ?? 0} open events ≤600 km
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              {(outlook?.disaster_risks ?? []).map((r) => (
                <div key={r.type} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{r.type}</span>
                    <span className={`text-[11px] font-mono-tabular font-bold ${statusTone(r.level)}`}>
                      {r.level.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">{r.summary_en}</div>
                  <div className="text-[10px] font-mono-tabular text-slate-400">{r.evidence}</div>
                </div>
              ))}
            </div>

            {outlook && outlook.nearby_eonet_events.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-200 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Flame className="w-3.5 h-3.5 text-[#A2461F]" />
                  <span>Nearest NASA EONET v3 Events</span>
                </div>
                {outlook.nearby_eonet_events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-slate-700">
                    <span className="truncate">
                      {ev.title} ({ev.category}) · {formatCalendarDate(ev.date)}
                    </span>
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#1F5A2E] hover:underline shrink-0"
                    >
                      <span>{ev.distance_km} km</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Long-Term Season Cycles & Progress Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#1F5A2E]" />
              <h2 className="text-base font-bold text-slate-900">
                Long-Term Season Cycles & Ground Check-In History
              </h2>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              {seasons.length} season(s) · {progressLogs.length} field log(s)
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-500">Crop Seasons</div>
              {seasons.length === 0 ? (
                <div className="text-xs text-slate-500">No seasons tracked for this farm yet.</div>
              ) : (
                seasons.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{s.season_name}</span>
                      <span className="font-mono-tabular text-[#1F5A2E]">{s.stage}</span>
                    </div>
                    <div className="font-mono-tabular text-slate-600">
                      Crop: {s.crop_id} · Planted: {formatCalendarDate(s.planted_date)} · Status: {s.status}
                    </div>
                    <div className="font-mono-tabular text-slate-500">
                      NASA Rain Since Planting: {s.nasa_rain_since_planting_mm ?? '—'} mm · Mean T2M: {s.nasa_mean_temp_since_planting_c ?? '—'}°C
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-500">Field Progress Logs</div>
              {progressLogs.length === 0 ? (
                <div className="text-xs text-slate-500">No farmer check-ins logged yet.</div>
              ) : (
                progressLogs.slice(0, 6).map((l) => (
                  <div key={l.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>{formatCalendarDate(l.log_date)} · {l.stage}</span>
                      <span className="font-mono-tabular text-slate-600">
                        Soil: {l.soil_feel} · Crop: {l.crop_condition}
                      </span>
                    </div>
                    {l.note && <div className="text-slate-600">{l.note}</div>}
                    <div className="font-mono-tabular text-[11px] text-slate-400">
                      NASA 7d Rain Snapshot: {l.nasa_rain_7d_mm ?? '—'} mm · GWETROOT: {l.nasa_wetness_snapshot ?? '—'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Transparent Crop-Rotation Analysis & Rules Trace */}
        {recommendation && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1F5A2E]" />
                <h2 className="text-base font-bold text-slate-900">
                  Explainable Crop-Rotation Decision Trace
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-slate-600">
                Evidence Quality: {recommendation.evidence_quality}
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {recommendation.rules_trace.map((r) => (
                <div key={r.rule_id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono-tabular font-semibold text-slate-700">{r.rule_id}</span>
                    <span className="text-[11px] font-semibold uppercase text-[#1F5A2E]">{r.outcome}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{r.detail}</p>
                </div>
              ))}
            </div>

            {discovery && (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono-tabular text-slate-700 space-y-1">
                <div className="font-bold text-slate-900">Latest Live CMR & STAC Metadata Discovery ({discovery.checkedAt.slice(0, 19)}Z):</div>
                <div>SRTMGL1 v003 Tile: {discovery.srtmGranuleId ?? 'None matched'}</div>
                <div>GPM_3IMERGDF V07 Granule: {discovery.gpmLatestGranule ?? 'None matched'}</div>
                <div>SMAP SPL3SMP_E Granule: {discovery.smapLatestGranule ?? 'None matched'}</div>
                <div>
                  USGS Landsat C2L2 SR Scenes:{' '}
                  {discovery.landsatScenes.length > 0
                    ? discovery.landsatScenes.map((s) => `${s.id} (${s.datetime.slice(0, 10)}, cloud ${s.cloudCover ?? '?'}%)`).join(' | ')
                    : 'None returned'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dataset Provenance & Pipeline Registry */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#1F5A2E]" />
              <h2 className="text-base font-bold text-slate-900">
                NASA Earth-Observation, Meteomatics Weather & Supabase Edge Registry
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Verified API provenance · Non-NASA imagery mocks excluded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4 font-semibold">Tier / Source</th>
                  <th className="py-3 px-4 font-semibold">Product & Version</th>
                  <th className="py-3 px-4 font-semibold">Native Resolution</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Notes & Limitations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 align-top">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">P{d.priority_tier} · {d.source}</div>
                      <a
                        href={d.source_reference}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#1F5A2E] hover:underline mt-0.5"
                      >
                        <span>Docs</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{d.product_name}</div>
                      <div className="font-mono-tabular text-slate-500">{d.product_version} · {d.unit}</div>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-700">{d.native_resolution}</td>
                    <td className={`py-3 px-4 font-semibold whitespace-nowrap ${statusTone(d.integration_status)}`}>
                      {d.integration_status}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-sm">
                      <div>{d.status_detail}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{d.processing_method}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ingestion Run Logs */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Data Ingestion Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono-tabular">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4">Dataset</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Records</th>
                  <th className="py-2.5 px-4">Started</th>
                  <th className="py-2.5 px-4">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ingestionRuns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 px-4 text-slate-500">
                      No ingestion runs logged for this farm yet. Click "Run Live NASA Sync" above.
                    </td>
                  </tr>
                ) : (
                  ingestionRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="py-2.5 px-4 text-slate-900">{run.dataset_id}</td>
                      <td className={`py-2.5 px-4 font-semibold ${statusTone(run.status)}`}>{run.status}</td>
                      <td className="py-2.5 px-4">{run.records_count}</td>
                      <td className="py-2.5 px-4 text-slate-500">{run.started_at.slice(0, 19)}Z</td>
                      <td className="py-2.5 px-4 text-slate-600">{run.error_message ?? 'OK'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NASA Attribution Footer */}
        <footer className="text-xs text-slate-500 border-t border-slate-200 pt-4 pb-6 flex flex-wrap items-center justify-between gap-2">
          <span>
            Data Acknowledgements: NASA Langley Research Center POWER Project, NASA EOSDIS GIBS, NASA EONET, NASA CMR, and USGS/NASA Landsat.
          </span>
          <span>
            NASA provides scientific data only and does not sponsor or endorse Farmova AI.
          </span>
        </footer>
      </div>
    </div>
  );
};
