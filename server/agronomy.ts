import crypto from 'node:crypto';
import { db, getCachedEonetEvents, getClimateBaseline, getObservations } from './db.ts';
import { haversineKm, inferAgroZone } from './regions.ts';
import type {
  ClimateBaselineMonth,
  CropId,
  CropRotationOption,
  CropRotationPlan,
  DailyObservation,
  DisasterRiskItem,
  EonetEventSummary,
  FarmIndicators,
  FarmRecord,
  HealthCategory,
  PriorityId,
  RecommendationRecord,
  RotationCalendarMonth,
  RuleTraceItem,
  SoilMoistureOutlook,
} from './types.ts';

export interface CropProfile {
  id: Exclude<CropId, 'help_me_decide'>;
  name: string;
  twiName: string;
  family: string;
  nitrogenRole: 'heavy_feeder' | 'nitrogen_fixer' | 'moderate_feeder' | 'potassium_tuber';
  waterNeed: 'low' | 'moderate' | 'high';
  droughtTolerance: 'high' | 'moderate' | 'low';
  idealTempRangeC: [number, number];
  rotationSummaryEn: string;
  rotationSummaryTw: string;
}

export const CROP_PROFILES: Record<Exclude<CropId, 'help_me_decide'>, CropProfile> = {
  maize: {
    id: 'maize',
    name: 'Maize',
    twiName: 'Aburo',
    family: 'Poaceae (Cereal)',
    nitrogenRole: 'heavy_feeder',
    waterNeed: 'moderate',
    droughtTolerance: 'moderate',
    idealTempRangeC: [20, 32],
    rotationSummaryEn: 'Uses significant soil nitrogen. Rotating after legumes (cowpea, groundnut, soybean) helps replenish nitrogen naturally.',
    rotationSummaryTw: 'Aburo di asase mu ahoɔden (nitrogen) pii. Sɛ wode adua te sɛ adua-kɔkɔɔ anaa nkatee di kan dua a, ɛboa ma aburo no nyini yiye.',
  },
  cassava: {
    id: 'cassava',
    name: 'Cassava',
    twiName: 'Bankye',
    family: 'Euphorbiaceae (Root)',
    nitrogenRole: 'potassium_tuber',
    waterNeed: 'low',
    droughtTolerance: 'high',
    idealTempRangeC: [22, 35],
    rotationSummaryEn: 'Hardy root crop tolerant of dry spells; draws potassium. Follow with legumes or fallow to restore topsoil organic matter.',
    rotationSummaryTw: 'Bankye tumi gyina owia ne nsuo a esua ano. Sɛ wotwa bankye a, dua adua na ɛnsiesie asase no ani bio.',
  },
  yam: {
    id: 'yam',
    name: 'Yam',
    twiName: 'Bayerɛ',
    family: 'Dioscoreaceae (Tuber)',
    nitrogenRole: 'potassium_tuber',
    waterNeed: 'moderate',
    droughtTolerance: 'moderate',
    idealTempRangeC: [23, 33],
    rotationSummaryEn: 'Prefers well-drained mounded soil and organic matter. Rotating with legumes before or after yam helps preserve soil fertility.',
    rotationSummaryTw: 'Bayerɛ pɛ asase a nsuo ntumi ngyina mu pii ne asase a ɛwɔ ahoɔden. Adua a ɛbɛdi akyi no boa asase no.',
  },
  rice: {
    id: 'rice',
    name: 'Rice',
    twiName: 'Ɛmo',
    family: 'Poaceae (Cereal)',
    nitrogenRole: 'heavy_feeder',
    waterNeed: 'high',
    droughtTolerance: 'low',
    idealTempRangeC: [21, 33],
    rotationSummaryEn: 'High moisture demand. In upland or lowland plots, rotating with short-duration cowpea or soybean breaks cereal pest cycles.',
    rotationSummaryTw: 'Ɛmo hia nsuo pii. Sɛ nsuo sua a, ɛyɛ hu ma ɛmo; sɛ wode adua sesa mu a, ɛbrɛ mmoawa ase.',
  },
  groundnut: {
    id: 'groundnut',
    name: 'Groundnut',
    twiName: 'Nkatee',
    family: 'Fabaceae (Legume)',
    nitrogenRole: 'nitrogen_fixer',
    waterNeed: 'low',
    droughtTolerance: 'high',
    idealTempRangeC: [22, 34],
    rotationSummaryEn: 'Fixes atmospheric nitrogen into the root zone and tolerates drier windows well. Strong rotation partner after cereals.',
    rotationSummaryTw: 'Nkatee de ahoɔden (nitrogen) san ba asase mu na etumi gyina nsuo a esua ano yiye.',
  },
  cowpea: {
    id: 'cowpea',
    name: 'Cowpea',
    twiName: 'Adua (Ayewa)',
    family: 'Fabaceae (Legume)',
    nitrogenRole: 'nitrogen_fixer',
    waterNeed: 'low',
    droughtTolerance: 'high',
    idealTempRangeC: [22, 35],
    rotationSummaryEn: 'Fast-maturing, drought-resilient legume that adds nitrogen and ground cover, ideal after cereals or during drier periods.',
    rotationSummaryTw: 'Adua nyini ntɛm, etumi gyina owia ano, na ɛma asase no nya ahoɔden foforɔ.',
  },
  soybean: {
    id: 'soybean',
    name: 'Soybean',
    twiName: 'Soyabin',
    family: 'Fabaceae (Legume)',
    nitrogenRole: 'nitrogen_fixer',
    waterNeed: 'moderate',
    droughtTolerance: 'moderate',
    idealTempRangeC: [20, 32],
    rotationSummaryEn: 'Strong nitrogen-fixing legume and high-value cash/food crop that breaks cereal pest and Striga cycles.',
    rotationSummaryTw: 'Soyabin ma asase no nya ahoɔden na esiw aburo mu nyarewa ne nwura bɔne ano.',
  },
  vegetables: {
    id: 'vegetables',
    name: 'Vegetables',
    twiName: 'Ntos / Nnuadewa',
    family: 'Solanaceae / Malvaceae (Mixed)',
    nitrogenRole: 'moderate_feeder',
    waterNeed: 'high',
    droughtTolerance: 'low',
    idealTempRangeC: [20, 32],
    rotationSummaryEn: 'Tomato, pepper, greens, and okra need steady moisture and careful pest rotation (avoid planting Solanaceae back-to-back).',
    rotationSummaryTw: 'Ntos, mako, ne nkruma hia nsuo daa. Mma nnua koro no ara nni akyi wɔ asase koro no ara so daa.',
  },
  other: {
    id: 'other',
    name: 'Other Crop',
    twiName: 'Afifideɛ foforɔ',
    family: 'Mixed',
    nitrogenRole: 'moderate_feeder',
    waterNeed: 'moderate',
    droughtTolerance: 'moderate',
    idealTempRangeC: [20, 34],
    rotationSummaryEn: 'Alternating crop families each season helps protect soil structure and reduce pest carryover.',
    rotationSummaryTw: 'Sɛ wosesa afifideɛ su afe biara a, ɛbɔ asase no ho ban na ɛtew mmoawa so.',
  },
};

export function computeAndSaveIndicators(farm: FarmRecord, knownElevationM?: number | null): FarmIndicators {
  const obs = getObservations(farm.id, 'nasa-power');
  const validObs = obs.filter((o) => o.PRECTOTCORR !== null || o.T2M !== null);
  const now = new Date().toISOString();

  if (validObs.length < 7) {
    const emptyIndicators: FarmIndicators = {
      farm_id: farm.id,
      computed_at: now,
      observation_start: null,
      observation_end: null,
      days_count: validObs.length,
      rainfall_30d_mm: null,
      rainfall_prev30d_mm: null,
      rainfall_anomaly_pct: null,
      dry_spell_days: null,
      mean_temp_c: null,
      max_temp_c: null,
      heat_stress_days: null,
      surface_wetness_index: null,
      root_wetness_index: null,
      solar_radiation_mj: null,
      relative_humidity_pct: null,
      evapotranspiration_mm_day: null,
      elevation_m: knownElevationM ?? null,
      slope_deg: null,
      health_category: 'Not enough information',
      data_source_mode: 'unavailable',
      limitations: [
        'Insufficient verified NASA POWER daily observations stored for this farm yet.',
        'Run a NASA POWER synchronization when online to compute 30-day rainfall and soil wetness trends.',
      ],
    };
    saveIndicators(emptyIndicators);
    return emptyIndicators;
  }

  const recent30 = validObs.slice(-30);
  const prev30 = validObs.slice(-60, -30);

  const sumRain = (arr: typeof validObs) => {
    const vals = arr.map((x) => x.PRECTOTCORR).filter((v): v is number => v !== null);
    return vals.length > 0 ? Number(vals.reduce((a, b) => a + b, 0).toFixed(1)) : null;
  };
  const avg = (vals: Array<number | null>) => {
    const clean = vals.filter((v): v is number => v !== null);
    return clean.length > 0 ? Number((clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(2)) : null;
  };

  const rainfall30d = sumRain(recent30);
  const rainfallPrev30d = prev30.length >= 10 ? sumRain(prev30) : null;
  const rainfallAnomalyPct =
    rainfall30d !== null && rainfallPrev30d !== null && rainfallPrev30d > 5
      ? Number((((rainfall30d - rainfallPrev30d) / rainfallPrev30d) * 100).toFixed(1))
      : null;

  let trailingDry = 0;
  for (let i = recent30.length - 1; i >= 0; i--) {
    const r = recent30[i].PRECTOTCORR;
    if (r !== null && r < 1.0) trailingDry++;
    else break;
  }
  let maxDryRun = 0;
  let curRun = 0;
  for (const row of recent30) {
    if (row.PRECTOTCORR !== null && row.PRECTOTCORR < 1.0) {
      curRun++;
      if (curRun > maxDryRun) maxDryRun = curRun;
    } else {
      curRun = 0;
    }
  }
  const drySpellDays = Math.max(trailingDry, maxDryRun);

  const meanTempC = avg(recent30.map((x) => x.T2M));
  const maxTempVals = recent30.map((x) => x.T2M_MAX).filter((v): v is number => v !== null);
  const maxTempC = maxTempVals.length > 0 ? Number(Math.max(...maxTempVals).toFixed(1)) : null;
  const heatStressDays = recent30.filter((x) => x.T2M_MAX !== null && x.T2M_MAX >= 34).length;

  const surfaceWetness = avg(recent30.slice(-7).map((x) => x.GWETTOP));
  const rootWetness = avg(recent30.slice(-7).map((x) => x.GWETROOT));
  const solarRad = avg(recent30.map((x) => x.ALLSKY_SFC_SW_DWN));
  const rh2m = avg(recent30.map((x) => x.RH2M));
  const etDay = avg(recent30.map((x) => x.EVPTRNS ?? x.EVLAND));

  const anyLive = recent30.some((x) => !x.is_simulated);
  const dataSourceMode: FarmIndicators['data_source_mode'] = anyLive ? 'live_nasa_power' : 'demonstration_cache';

  let healthCategory: HealthCategory = 'Good conditions';
  if (
    (rainfall30d !== null && rainfall30d < 20 && (rootWetness === null || rootWetness < 0.42)) ||
    drySpellDays >= 12 ||
    heatStressDays >= 10
  ) {
    healthCategory = 'Needs attention';
  } else if (
    (rainfallAnomalyPct !== null && rainfallAnomalyPct < -25) ||
    (surfaceWetness !== null && surfaceWetness < 0.48) ||
    drySpellDays >= 7 ||
    heatStressDays >= 5
  ) {
    healthCategory = 'Watch carefully';
  }

  const existing = db.prepare(`SELECT elevation_m FROM farm_indicators WHERE farm_id = ?`).get(farm.id) as { elevation_m?: number } | undefined;
  const elevationM = knownElevationM ?? existing?.elevation_m ?? null;

  const limitations = [
    'NASA POWER meteorological & soil wetness variables are modelled on an ~50 km (0.5° × 0.625°) grid and reflect regional conditions around your farm rather than plot-scale soil probes.',
    'GWETTOP and GWETROOT are NASA MERRA-2 modelled soil wetness indices (0–1 scale), not direct in-situ soil moisture sensor readings.',
    'Health categories and 7–14 day soil moisture projections are decision-support estimates derived from NASA observations and seasonal climatology.',
  ];
  if (dataSourceMode === 'demonstration_cache') {
    limitations.unshift('Currently showing clearly marked demonstration baseline observations. Refresh with NASA POWER when online for live measurements.');
  }

  const indicators: FarmIndicators = {
    farm_id: farm.id,
    computed_at: now,
    observation_start: validObs[0].date,
    observation_end: validObs[validObs.length - 1].date,
    days_count: validObs.length,
    rainfall_30d_mm: rainfall30d,
    rainfall_prev30d_mm: rainfallPrev30d,
    rainfall_anomaly_pct: rainfallAnomalyPct,
    dry_spell_days: drySpellDays,
    mean_temp_c: meanTempC,
    max_temp_c: maxTempC,
    heat_stress_days: heatStressDays,
    surface_wetness_index: surfaceWetness,
    root_wetness_index: rootWetness,
    solar_radiation_mj: solarRad,
    relative_humidity_pct: rh2m,
    evapotranspiration_mm_day: etDay,
    elevation_m: elevationM,
    slope_deg: null,
    health_category: healthCategory,
    data_source_mode: dataSourceMode,
    limitations,
  };

  saveIndicators(indicators);
  return indicators;
}

export function computeSoilMoistureAndRiskOutlook(
  farm: FarmRecord,
  indicators: FarmIndicators,
  observations?: DailyObservation[],
  climatology?: ClimateBaselineMonth[]
): SoilMoistureOutlook {
  const obs = observations ?? getObservations(farm.id, 'nasa-power');
  const clim = climatology && climatology.length === 12 ? climatology : getClimateBaseline(farm.id);
  const rawEvents = getCachedEonetEvents();

  const recent14 = obs.slice(-14);
  const prev14 = obs.slice(-28, -14);

  // Compute daily net water balance (PRECTOTCORR - EVLAND)
  const netBalances = recent14
    .map((o) => {
      if (o.PRECTOTCORR === null) return null;
      const evap = o.EVLAND ?? o.EVPTRNS ?? 3.2;
      return o.PRECTOTCORR - evap;
    })
    .filter((v): v is number => v !== null);

  const netWaterBalanceMmDay =
    netBalances.length > 0
      ? Number((netBalances.reduce((a, b) => a + b, 0) / netBalances.length).toFixed(2))
      : null;

  const avgWet = (arr: DailyObservation[]) => {
    const vals = arr.map((x) => x.GWETROOT).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const currentWet = indicators.root_wetness_index;
  const recent7Wet = avgWet(obs.slice(-7));
  const prev14Wet = avgWet(prev14);

  // Climate normal comparison for current & next UTC month
  const nowMonthIdx = new Date().getUTCMonth(); // 0..11
  const nextMonthIdx = (nowMonthIdx + 1) % 12;
  const curClim = clim[nowMonthIdx] ?? null;
  const nextClim = clim[nextMonthIdx] ?? null;

  const expectedMonthRain30d =
    curClim?.precip_mm_day !== null && curClim?.precip_mm_day !== undefined
      ? curClim.precip_mm_day * 30
      : null;

  const climateRainAnomalyPct =
    indicators.rainfall_30d_mm !== null && expectedMonthRain30d !== null && expectedMonthRain30d > 5
      ? Number((((indicators.rainfall_30d_mm - expectedMonthRain30d) / expectedMonthRain30d) * 100).toFixed(1))
      : null;

  const climateTempDiffC =
    indicators.mean_temp_c !== null && curClim?.temp_c !== null && curClim?.temp_c !== undefined
      ? Number((indicators.mean_temp_c - curClim.temp_c).toFixed(1))
      : null;

  // Water-balance 7-day & 14-day soil moisture trajectory
  let projected7d: number | null = null;
  let projected14d: number | null = null;
  let trendDirection: SoilMoistureOutlook['trend_direction'] = 'unknown';

  if (currentWet !== null) {
    const obsSlopePerDay =
      recent7Wet !== null && prev14Wet !== null ? (recent7Wet - prev14Wet) / 14 : (netWaterBalanceMmDay ?? 0) * 0.006;
    const climPullPerDay =
      nextClim?.gwetroot !== null && nextClim?.gwetroot !== undefined ? (nextClim.gwetroot - currentWet) / 30 : 0;
    const blendedDailyRate = Math.max(-0.02, Math.min(0.02, obsSlopePerDay * 0.65 + climPullPerDay * 0.35));

    projected7d = Number(Math.max(0.08, Math.min(0.95, currentWet + blendedDailyRate * 7)).toFixed(2));
    projected14d = Number(Math.max(0.08, Math.min(0.95, currentWet + blendedDailyRate * 14)).toFixed(2));

    if (projected14d - currentWet <= -0.03) trendDirection = 'drying';
    else if (projected14d - currentWet >= 0.03) trendDirection = 'wetting';
    else trendDirection = 'stable';
  }

  // Nearby NASA EONET natural disaster events within 600 km
  const nearbyEvents: EonetEventSummary[] = rawEvents
    .map((ev) => ({
      ...ev,
      distance_km: haversineKm(farm.latitude, farm.longitude, ev.latitude, ev.longitude),
    }))
    .filter((ev) => ev.distance_km <= 600)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 6);

  // Transparent Disaster & Hazard Risk Evaluation
  const recent7Rain = obs
    .slice(-7)
    .map((o) => o.PRECTOTCORR)
    .filter((v): v is number => v !== null)
    .reduce((a, b) => a + b, 0);

  const droughtLevel: DisasterRiskItem['level'] =
    (indicators.dry_spell_days ?? 0) >= 12 ||
    (projected14d !== null && projected14d < 0.38) ||
    (climateRainAnomalyPct !== null && climateRainAnomalyPct <= -45)
      ? 'Elevated'
      : (indicators.dry_spell_days ?? 0) >= 7 ||
        (climateRainAnomalyPct !== null && climateRainAnomalyPct <= -20)
      ? 'Moderate'
      : 'Low';

  const floodLevel: DisasterRiskItem['level'] =
    recent7Rain >= 110 || ((indicators.surface_wetness_index ?? 0) >= 0.82 && recent7Rain >= 60)
      ? 'Elevated'
      : recent7Rain >= 70 || (indicators.surface_wetness_index ?? 0) >= 0.78
      ? 'Moderate'
      : 'Low';

  const heatLevel: DisasterRiskItem['level'] =
    (indicators.heat_stress_days ?? 0) >= 10 || (climateTempDiffC !== null && climateTempDiffC >= 2.0)
      ? 'Elevated'
      : (indicators.heat_stress_days ?? 0) >= 4 || (climateTempDiffC !== null && climateTempDiffC >= 1.0)
      ? 'Moderate'
      : 'Low';

  const closestHazard = nearbyEvents[0] ?? null;
  const hazardLevel: DisasterRiskItem['level'] =
    closestHazard && closestHazard.distance_km <= 120
      ? 'Elevated'
      : closestHazard && closestHazard.distance_km <= 350
      ? 'Moderate'
      : 'Low';

  const disasterRisks: DisasterRiskItem[] = [
    {
      type: 'Drought & Dry-Spell Risk',
      level: droughtLevel,
      summary_en:
        droughtLevel === 'Elevated'
          ? 'Extended dry spell and falling root-zone moisture indicate high sensitivity for shallow-rooted crops.'
          : droughtLevel === 'Moderate'
          ? 'Moisture is below seasonal average; conserve topsoil cover with mulch.'
          : 'Recent rainfall and root-zone wetness show low near-term drought stress.',
      summary_tw:
        droughtLevel === 'Elevated'
          ? 'Owia ne nsuo a ɛtɔe sua no kyerɛ sɛ fɔ a ɛwɔ asase mu rekɔ fam.'
          : droughtLevel === 'Moderate'
          ? 'Nsuo sua kakra kyɛn afe biara deɛ; fa nwura kata asase so.'
          : 'Asase mu fɔ ne nsuo tebea mu nni pɛsɛmenkominya kɛse biara seesei.',
      evidence: `Dry spell: ${indicators.dry_spell_days ?? 'N/A'}d · Climate rain delta: ${climateRainAnomalyPct !== null ? `${climateRainAnomalyPct}%` : 'N/A'} · 14d projected GWETROOT: ${projected14d ?? 'N/A'}`,
    },
    {
      type: 'Flood & Waterlogging Risk',
      level: floodLevel,
      summary_en:
        floodLevel === 'Elevated'
          ? 'Heavy 7-day rainfall combined with saturated topsoil elevates runoff and waterlogging risk.'
          : floodLevel === 'Moderate'
          ? 'Topsoil moisture is high; check plot drainage channels before heavy storms.'
          : '7-day rainfall accumulation and surface wetness remain within well-drained bounds.',
      summary_tw:
        floodLevel === 'Elevated'
          ? 'Nsuo pii atɔ nnansa yi ma asase no ani ayɛ ma; hwɛ nsuo kwan yiye.'
          : floodLevel === 'Moderate'
          ? 'Fɔ wɔ asase no ani pii; siesie nsuo kwan wɔ afuw mu.'
          : 'Nsuo a atɔ nnawɔtwe yi mu nkyene afuw no so.',
      evidence: `7-day rainfall: ${recent7Rain.toFixed(1)} mm · Topsoil GWETTOP: ${indicators.surface_wetness_index ?? 'N/A'}`,
    },
    {
      type: 'Heat-Stress Risk',
      level: heatLevel,
      summary_en:
        heatLevel === 'Elevated'
          ? 'Frequent hot days ≥34°C above NASA 20-year normal increase crop evaporation demand.'
          : heatLevel === 'Moderate'
          ? 'Warm afternoon peaks may stress sensitive seedlings; water or shade nurseries if needed.'
          : 'Air temperatures remain within comfortable crop growth thresholds.',
      summary_tw:
        heatLevel === 'Elevated'
          ? 'Owia a ano yɛ den (≥34°C) taa ba nnafua yi mu na ɛtwe asase mu nsuo.'
          : heatLevel === 'Moderate'
          ? 'Awia mu hye kɔ soro kakra; hwɛ nnua nketewa yiye.'
          : 'Wiem hye tebea ye ma afifideɛ nyini.',
      evidence: `Heat days ≥34°C: ${indicators.heat_stress_days ?? 0}d · Temp vs NASA 20yr norm: ${climateTempDiffC !== null ? `${climateTempDiffC > 0 ? '+' : ''}${climateTempDiffC}°C` : 'N/A'}`,
    },
    {
      type: 'Regional Hazard Proximity',
      level: hazardLevel,
      summary_en: closestHazard
        ? `NASA EONET tracks "${closestHazard.title}" (${closestHazard.category}) ${closestHazard.distance_km} km away.`
        : 'No active NASA EONET wildfires, severe storms, or flood events detected within 600 km.',
      summary_tw: closestHazard
        ? `NASA EONET ahu "${closestHazard.title}" (${closestHazard.category}) wɔ kilomita ${closestHazard.distance_km} akyirikyiri.`
        : 'NASA EONET anhu ogya, ahum, anaa nsuyiri biara wɔ kilomita 600 mu.',
      evidence: `NASA EONET v3 (${nearbyEvents.length} open events within 600 km)`,
    },
  ];

  return {
    current_root_wetness: currentWet,
    projected_7d_wetness: projected7d,
    projected_14d_wetness: projected14d,
    net_water_balance_mm_day: netWaterBalanceMmDay,
    trend_direction: trendDirection,
    climate_rainfall_vs_normal_pct: climateRainAnomalyPct,
    climate_temp_vs_normal_c: climateTempDiffC,
    next_month_climate_rain_mm_day: nextClim?.precip_mm_day ?? null,
    next_month_label: nextClim?.month ?? 'NEXT',
    methodology_note:
      '7–14 day soil wetness outlook is a water-balance trajectory derived from NASA POWER MERRA-2 daily precipitation/evaporation (PRECTOTCORR - EVLAND) blended with NASA POWER 20-year monthly climatology.',
    disaster_risks: disasterRisks,
    nearby_eonet_events: nearbyEvents,
  };
}

function saveIndicators(ind: FarmIndicators): void {
  db.prepare(`
    INSERT INTO farm_indicators (
      farm_id, computed_at, observation_start, observation_end, days_count,
      rainfall_30d_mm, rainfall_prev30d_mm, rainfall_anomaly_pct, dry_spell_days,
      mean_temp_c, max_temp_c, heat_stress_days, surface_wetness_index,
      root_wetness_index, solar_radiation_mj, relative_humidity_pct,
      evapotranspiration_mm_day, elevation_m, slope_deg, health_category,
      data_source_mode, limitations_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(farm_id) DO UPDATE SET
      computed_at = excluded.computed_at,
      observation_start = excluded.observation_start,
      observation_end = excluded.observation_end,
      days_count = excluded.days_count,
      rainfall_30d_mm = excluded.rainfall_30d_mm,
      rainfall_prev30d_mm = excluded.rainfall_prev30d_mm,
      rainfall_anomaly_pct = excluded.rainfall_anomaly_pct,
      dry_spell_days = excluded.dry_spell_days,
      mean_temp_c = excluded.mean_temp_c,
      max_temp_c = excluded.max_temp_c,
      heat_stress_days = excluded.heat_stress_days,
      surface_wetness_index = excluded.surface_wetness_index,
      root_wetness_index = excluded.root_wetness_index,
      solar_radiation_mj = excluded.solar_radiation_mj,
      relative_humidity_pct = excluded.relative_humidity_pct,
      evapotranspiration_mm_day = excluded.evapotranspiration_mm_day,
      elevation_m = COALESCE(excluded.elevation_m, farm_indicators.elevation_m),
      slope_deg = excluded.slope_deg,
      health_category = excluded.health_category,
      data_source_mode = excluded.data_source_mode,
      limitations_json = excluded.limitations_json
  `).run(
    ind.farm_id,
    ind.computed_at,
    ind.observation_start,
    ind.observation_end,
    ind.days_count,
    ind.rainfall_30d_mm,
    ind.rainfall_prev30d_mm,
    ind.rainfall_anomaly_pct,
    ind.dry_spell_days,
    ind.mean_temp_c,
    ind.max_temp_c,
    ind.heat_stress_days,
    ind.surface_wetness_index,
    ind.root_wetness_index,
    ind.solar_radiation_mj,
    ind.relative_humidity_pct,
    ind.evapotranspiration_mm_day,
    ind.elevation_m,
    ind.slope_deg,
    ind.health_category,
    ind.data_source_mode,
    JSON.stringify(ind.limitations)
  );
}

export function generateAndSaveRecommendation(farm: FarmRecord, indicators: FarmIndicators): RecommendationRecord {
  const prevId = farm.previous_crop && farm.previous_crop !== 'help_me_decide' ? farm.previous_crop : null;
  const intendedId = farm.intended_crop ?? 'help_me_decide';
  const priorities: PriorityId[] = farm.priorities ?? [];
  const agroZone = inferAgroZone(farm.latitude, farm.longitude);
  const rulesTrace: RuleTraceItem[] = [];

  const isDryOrLowRain =
    indicators.health_category === 'Needs attention' ||
    (indicators.rainfall_30d_mm !== null && indicators.rainfall_30d_mm < 40) ||
    (indicators.dry_spell_days !== null && indicators.dry_spell_days >= 8) ||
    (indicators.surface_wetness_index !== null && indicators.surface_wetness_index < 0.45);

  const isHighRain =
    indicators.rainfall_30d_mm !== null &&
    indicators.rainfall_30d_mm >= 95 &&
    (indicators.root_wetness_index === null || indicators.root_wetness_index >= 0.58);

  const wantsSoil = priorities.includes('improve_soil') || priorities.includes('lower_costs');
  const wantsLowWaterStress = priorities.includes('less_water_stress');

  rulesTrace.push({
    rule_id: 'CONTEXT_GLOBAL_AGRO_ZONE',
    title: 'Global Agro-Climatic Belt Classification',
    outcome: 'context',
    detail: `Farm at (${farm.latitude.toFixed(3)}°, ${farm.longitude.toFixed(3)}°) falls in ${agroZone}.`,
  });

  if (indicators.data_source_mode === 'unavailable') {
    rulesTrace.push({
      rule_id: 'DATA_AVAILABILITY_CHECK',
      title: 'NASA Observation Availability',
      outcome: 'caution',
      detail: 'Insufficient environmental observations; recommendation relies on crop-family rotation rules only.',
    });
  } else {
    rulesTrace.push({
      rule_id: 'ENV_MOISTURE_CHECK',
      title: '30-Day Moisture & Dry-Spell Assessment',
      outcome: isDryOrLowRain ? 'caution' : 'matched',
      detail: `30-day rainfall: ${indicators.rainfall_30d_mm ?? 'N/A'} mm; dry spell: ${indicators.dry_spell_days ?? 'N/A'} days; surface wetness: ${indicators.surface_wetness_index ?? 'N/A'}.`,
    });
  }

  let suggestedId: Exclude<CropId, 'help_me_decide'> = 'cowpea';
  let headlineEn = '';
  let headlineTw = '';
  let reasonEn = '';
  let reasonTw = '';
  const nextActionsEn: string[] = [];
  const nextActionsTw: string[] = [];

  const prevProfile = prevId && prevId in CROP_PROFILES ? CROP_PROFILES[prevId as Exclude<CropId, 'help_me_decide'>] : null;
  const intendedProfile =
    intendedId !== 'help_me_decide' && intendedId in CROP_PROFILES
      ? CROP_PROFILES[intendedId as Exclude<CropId, 'help_me_decide'>]
      : null;

  if (prevProfile?.nitrogenRole === 'heavy_feeder' && (intendedId === 'help_me_decide' || intendedId === prevId || wantsSoil || isDryOrLowRain)) {
    suggestedId =
      isDryOrLowRain || wantsLowWaterStress
        ? 'cowpea'
        : Math.abs(farm.latitude) > 25
        ? 'soybean'
        : agroZone.includes('Savanna')
        ? 'groundnut'
        : 'soybean';
    rulesTrace.push({
      rule_id: 'RULE_CEREAL_TO_LEGUME_N_FIXATION',
      title: 'Break Cereal Monoculture & Restore Nitrogen',
      outcome: 'matched',
      detail: `Previous crop (${prevProfile.name}) is a heavy nitrogen feeder. Rotating to ${CROP_PROFILES[suggestedId].name} (Fabaceae) rebuilds nitrogen and breaks cereal pest pressure.`,
    });
  } else if (prevProfile?.nitrogenRole === 'nitrogen_fixer' && !isDryOrLowRain) {
    if (intendedProfile && intendedProfile.id !== prevProfile.id) {
      suggestedId = intendedProfile.id;
    } else {
      suggestedId = isHighRain ? 'rice' : 'maize';
    }
    rulesTrace.push({
      rule_id: 'RULE_LEGUME_TO_CEREAL_BENEFIT',
      title: 'Follow Nitrogen-Fixing Legume with Cereal or Tuber',
      outcome: 'matched',
      detail: `Previous legume (${prevProfile.name}) enriches root-zone nitrogen, supporting ${CROP_PROFILES[suggestedId].name} under adequate moisture.`,
    });
  } else if (intendedProfile) {
    if (intendedProfile.waterNeed === 'high' && isDryOrLowRain) {
      suggestedId = 'cowpea';
      rulesTrace.push({
        rule_id: 'RULE_HIGH_WATER_CROP_DRY_RISK',
        title: 'Water-Stress Caution for High-Demand Crop',
        outcome: 'caution',
        detail: `Intended crop (${intendedProfile.name}) requires high water, while recent 30-day conditions are drier (${indicators.rainfall_30d_mm ?? '?'} mm). Suggesting drought-resilient Cowpea or delaying planting until steady rain resumes.`,
      });
    } else if (intendedProfile.id === prevProfile?.id) {
      suggestedId = intendedProfile.nitrogenRole === 'heavy_feeder' ? 'groundnut' : 'maize';
      rulesTrace.push({
        rule_id: 'RULE_AVOID_SAME_FAMILY_REPEAT',
        title: 'Avoid Back-to-Back Same-Family Planting',
        outcome: 'caution',
        detail: `Planting ${intendedProfile.name} repeatedly increases soil nutrient depletion and pest buildup. Rotating with ${CROP_PROFILES[suggestedId].name} is advised.`,
      });
    } else {
      suggestedId = intendedProfile.id;
      rulesTrace.push({
        rule_id: 'RULE_INTENDED_CROP_COMPATIBLE',
        title: 'Intended Crop Matches Rotation & Moisture Window',
        outcome: 'matched',
        detail: `${intendedProfile.name} aligns with crop-family rotation after ${prevProfile?.name ?? 'prior season'} and current environmental conditions.`,
      });
    }
  } else {
    suggestedId = isDryOrLowRain || wantsLowWaterStress ? 'cowpea' : wantsSoil ? 'soybean' : 'maize';
    rulesTrace.push({
      rule_id: 'RULE_GENERAL_MOISTURE_PRIORITY',
      title: 'Environmental Moisture & Priority Selection',
      outcome: 'matched',
      detail: `Selected ${CROP_PROFILES[suggestedId].name} based on recent moisture availability and farmer priorities.`,
    });
  }

  const chosen = CROP_PROFILES[suggestedId];
  const placeLabel = farm.community || farm.district || farm.country || 'your farm';

  if (isDryOrLowRain) {
    headlineEn = `Recent rainfall has been low — consider ${chosen.name} or wait for steady rain`;
    headlineTw = `Nsuo a ɛtɔe nkyɛe yi sua — susuw ${chosen.twiName} ho anaa twɛn nsuo pa`;
    reasonEn =
      `Around ${placeLabel}, NASA POWER shows ${indicators.rainfall_30d_mm !== null ? `${indicators.rainfall_30d_mm} mm` : 'low'} ` +
      `of rainfall over the last 30 days with ${indicators.dry_spell_days ?? 'several'} dry days. ` +
      `${prevProfile ? `Because you grew ${prevProfile.name} last season, planting ` : 'Planting '}` +
      `${chosen.name} helps protect soil nutrients and handles drier conditions better than water-heavy crops.`;
    reasonTw =
      `Wɔ ${placeLabel} mpɔtam no, nsuo a ɛtɔe nkyɛe yi sua kakra ` +
      `(${indicators.rainfall_30d_mm !== null ? `${indicators.rainfall_30d_mm} mm` : 'asase no awo'}). ` +
      `${prevProfile ? `Esiane sɛ wuduaa ${prevProfile.twiName} afe a etwaam no nti, ` : ''}` +
      `${chosen.twiName} dua bɛboa asase no ahoɔden na etumi gyina owia ne nsuo a esua ano yiye.`;
    nextActionsEn.push(
      'Check soil moisture 10 cm deep before planting.',
      `Use crop residue mulch to reduce topsoil evaporation for ${chosen.name}.`,
      'Consult local agricultural extension advice on certified short-duration seed.'
    );
    nextActionsTw.push(
      'Miamia asase no mu kakra wɔ aseɛ hɔ hwɛ sɛ fɔ wɔ mu ansa na woadua.',
      `Fa nwura a atwa so kata asase no so na nsuo ntena mu mma ${chosen.twiName}.`,
      'Kɔbisa kuayɛ fotufoɔ hɔ aba pa a ɛnyini ntɛm.'
    );
  } else {
    headlineEn = `Conditions look favourable — ${chosen.name} is a strong next rotation option`;
    headlineTw = `Asase ne wiem tebea ye — ${chosen.twiName} yɛ aduane pa a wobɛtumi adua akyiri yi`;
    reasonEn =
      `Recent NASA observations around ${placeLabel} show ` +
      `${indicators.rainfall_30d_mm !== null ? `${indicators.rainfall_30d_mm} mm of rainfall over 30 days` : 'balanced moisture'} ` +
      `and ${indicators.mean_temp_c !== null ? `average temperatures around ${indicators.mean_temp_c}°C` : 'moderate temperatures'}. ` +
      `${prevProfile ? `Following ${prevProfile.name} with ${chosen.name} (${chosen.family}) ` : `Planting ${chosen.name} `}` +
      `supports healthier soil nutrient balance and reduces repeat pest pressure.`;
    reasonTw =
      `Wiem ne asase tebea wɔ ${placeLabel} mpɔtam yi mu ye seesei ` +
      `(${indicators.rainfall_30d_mm !== null ? `nsuo ${indicators.rainfall_30d_mm} mm` : 'fɔ wɔ asase mu'}). ` +
      `${prevProfile ? `Sɛ wudi ${prevProfile.twiName} akyi dua ${chosen.twiName} a, ` : `Sɛ wudua ${chosen.twiName} a, `}` +
      `ɛboa ma asase no nya ahoɔden foforɔ na ɛtew afuw mu mmoawa so.`;
    nextActionsEn.push(
      `Inspect plot drainage before planting ${chosen.name}.`,
      'Log your planting date in Farmova Season Progress so NASA rainfall is tracked automatically.',
      'Check back weekly to monitor soil moisture outlook and hazard alerts.'
    );
    nextActionsTw.push(
      `Hwɛ sɛ nsuo ntumi nkyene asase no so mmoroso ansa na woadua ${chosen.twiName}.`,
      'Hyɛ da a wuduae no wɔ Farmova so na yɛnhwɛ nsuo ne asase nkɔsoɔ.',
      'San bra Farmova so dapɛn biara na yɛnhwɛ nsuo ne wiem nsakrae.'
    );
  }

  const supportingIndicators: Array<{ label: string; value: string; source: string }> = [
    {
      label: '30-Day Cumulative Rainfall',
      value: indicators.rainfall_30d_mm !== null ? `${indicators.rainfall_30d_mm} mm` : 'Unavailable',
      source: 'NASA POWER (PRECTOTCORR, ~50 km)',
    },
    {
      label: 'Recent Dry-Spell Length',
      value: indicators.dry_spell_days !== null ? `${indicators.dry_spell_days} consecutive dry days` : 'Unavailable',
      source: 'Derived from NASA POWER PRECTOTCORR < 1 mm/day',
    },
    {
      label: 'Mean Air Temperature (30d)',
      value: indicators.mean_temp_c !== null ? `${indicators.mean_temp_c} °C` : 'Unavailable',
      source: 'NASA POWER (T2M, ~50 km)',
    },
    {
      label: 'Modelled Root-Zone Wetness',
      value: indicators.root_wetness_index !== null ? `${Math.round(indicators.root_wetness_index * 100)}% index (${indicators.root_wetness_index})` : 'Unavailable',
      source: 'NASA POWER / MERRA-2 (GWETROOT, 0–100 cm)',
    },
    {
      label: 'Farm Elevation Context',
      value: indicators.elevation_m !== null ? `${indicators.elevation_m} m` : 'Pending lookup',
      source: 'NASA POWER / SRTMGL1 v003',
    },
  ];

  const evidenceQuality: RecommendationRecord['evidence_quality'] =
    indicators.data_source_mode === 'live_nasa_power'
      ? 'High (Live NASA + Agronomy Rules)'
      : indicators.data_source_mode === 'demonstration_cache'
      ? 'Demonstration Only'
      : 'Moderate (Coarse Scale / Partial Data)';

  const rec: RecommendationRecord = {
    id: crypto.randomUUID(),
    farm_id: farm.id,
    previous_crop: prevProfile?.name ?? null,
    intended_crop: intendedProfile?.name ?? (intendedId === 'help_me_decide' ? 'Help me decide' : null),
    priority: priorities.join(', ') || null,
    suggested_crop: chosen.name,
    suggested_crop_id: suggestedId,
    headline_en: headlineEn,
    headline_tw: headlineTw,
    reason_en: reasonEn,
    reason_tw: reasonTw,
    next_actions_en: nextActionsEn,
    next_actions_tw: nextActionsTw,
    supporting_indicators: supportingIndicators,
    limitations: indicators.limitations,
    evidence_quality: evidenceQuality,
    rules_trace: rulesTrace,
    created_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO recommendations (
      id, farm_id, previous_crop, intended_crop, priority, suggested_crop,
      suggested_crop_id, headline_en, headline_tw, reason_en, reason_tw,
      next_actions_en_json, next_actions_tw_json, supporting_indicators_json,
      limitations_json, evidence_quality, rules_trace_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rec.id,
    rec.farm_id,
    rec.previous_crop,
    rec.intended_crop,
    rec.priority,
    rec.suggested_crop,
    rec.suggested_crop_id,
    rec.headline_en,
    rec.headline_tw,
    rec.reason_en,
    rec.reason_tw,
    JSON.stringify(rec.next_actions_en),
    JSON.stringify(rec.next_actions_tw),
    JSON.stringify(rec.supporting_indicators),
    JSON.stringify(rec.limitations),
    rec.evidence_quality,
    JSON.stringify(rec.rules_trace),
    rec.created_at
  );

  return rec;
}

export function computeCropRotationPlan(
  farm: FarmRecord,
  indicators: FarmIndicators,
  outlook: SoilMoistureOutlook,
  climatology: ClimateBaselineMonth[],
  intendedOverride?: CropId | null
): CropRotationPlan {
  const prevId = (farm.previous_crop && farm.previous_crop !== 'help_me_decide' ? farm.previous_crop : null) as
    | Exclude<CropId, 'help_me_decide'>
    | null;
  const intendedId = intendedOverride ?? farm.intended_crop ?? 'help_me_decide';
  const prevProfile = prevId && prevId in CROP_PROFILES ? CROP_PROFILES[prevId] : null;
  const priorities: PriorityId[] = farm.priorities ?? [];
  const wantsSoil = priorities.includes('improve_soil') || priorities.includes('lower_costs');
  const wantsLowWater = priorities.includes('less_water_stress');

  const rootWet = outlook.projected_7d_wetness ?? indicators.root_wetness_index ?? 0.52;
  const surfWet = indicators.surface_wetness_index ?? 0.52;
  const rain30 = indicators.rainfall_30d_mm ?? 60;
  const meanTemp = indicators.mean_temp_c ?? 27;
  const dryDays = indicators.dry_spell_days ?? 0;

  const isDry = rain30 < 40 || dryDays >= 8 || rootWet < 0.44;
  const isWet = rain30 >= 95 && rootWet >= 0.58;
  const isWaterlogged = surfWet >= 0.82 && rain30 >= 110;

  const candidateIds: Array<Exclude<CropId, 'help_me_decide'>> = [
    'cowpea',
    'groundnut',
    'soybean',
    'maize',
    'cassava',
    'yam',
    'rice',
    'vegetables',
  ];

  const scored: CropRotationOption[] = candidateIds.map((cid) => {
    const prof = CROP_PROFILES[cid];
    let score = 60;
    const reasons: string[] = [];

    // 1. Nitrogen & crop-family rotation complementarity
    if (prevProfile) {
      if (cid === prevProfile.id) {
        score -= 28;
        reasons.push(`Repeating ${prof.name} back-to-back increases pest carryover and nutrient fatigue.`);
      } else if (prevProfile.nitrogenRole === 'heavy_feeder' && prof.nitrogenRole === 'nitrogen_fixer') {
        score += 24;
        reasons.push(`Restores soil nitrogen depleted by ${prevProfile.name} and breaks cereal pest cycles.`);
      } else if (prevProfile.nitrogenRole === 'nitrogen_fixer' && prof.nitrogenRole === 'heavy_feeder') {
        score += 22;
        reasons.push(`Captures root-zone nitrogen fixed by previous ${prevProfile.name}.`);
      } else if (prevProfile.nitrogenRole === 'potassium_tuber' && prof.nitrogenRole === 'nitrogen_fixer') {
        score += 18;
        reasons.push(`Rebuilds organic cover and nitrogen after ${prevProfile.name} tuber harvest.`);
      } else if (prof.family !== prevProfile.family) {
        score += 10;
        reasons.push(`Rotates crop family (${prof.family}) away from ${prevProfile.family}.`);
      }
    } else {
      if (prof.nitrogenRole === 'nitrogen_fixer') {
        score += 10;
        reasons.push('Nitrogen-fixing legume builds baseline soil fertility.');
      }
    }

    // 2. Moisture & drought fit
    if (isDry) {
      if (prof.droughtTolerance === 'high') {
        score += 16;
        reasons.push('High drought resilience fits drier 7–14 day soil moisture trajectory.');
      } else if (prof.waterNeed === 'high') {
        score -= 22;
        reasons.push('High water requirement faces stress under current dry conditions.');
      }
    } else if (isWet) {
      if (prof.waterNeed === 'high' || prof.waterNeed === 'moderate') {
        score += 12;
        reasons.push('Adequate recent rainfall and root wetness support active vegetative growth.');
      }
    }

    // 3. Temperature window fit
    if (meanTemp >= prof.idealTempRangeC[0] && meanTemp <= prof.idealTempRangeC[1]) {
      score += 6;
    } else {
      score -= 8;
      reasons.push(`Local temperature (${meanTemp}°C) sits near the edge of ideal range (${prof.idealTempRangeC[0]}–${prof.idealTempRangeC[1]}°C).`);
    }

    // 4. Farmer priorities
    if (wantsSoil && prof.nitrogenRole === 'nitrogen_fixer') score += 8;
    if (wantsLowWater && prof.droughtTolerance === 'high') score += 8;
    if (intendedId === cid) score += 4;

    const clamped = Math.max(15, Math.min(98, score));
    const soilBenefit =
      prof.nitrogenRole === 'nitrogen_fixer'
        ? 'Adds root-zone nitrogen (+N)'
        : prof.nitrogenRole === 'heavy_feeder'
        ? 'High nitrogen demand (follow with legume)'
        : prof.nitrogenRole === 'potassium_tuber'
        ? 'Deep root uptake (follow with legume/mulch)'
        : 'Balanced nutrient demand';

    return {
      crop_id: cid,
      name: prof.name,
      family: prof.family,
      nitrogen_role: prof.nitrogenRole,
      water_need: prof.waterNeed,
      drought_tolerance: prof.droughtTolerance,
      fit_score: clamped,
      fit_label: clamped >= 78 ? 'Best Rotation Match' : clamped >= 55 ? 'Strong Alternative' : 'Caution',
      why_it_fits: reasons[0] ?? prof.rotationSummaryEn,
      soil_benefit: soilBenefit,
    };
  });

  scored.sort((a, b) => b.fit_score - a.fit_score);
  const top3 = scored.slice(0, 3);
  const best = top3[0];

  // Compatibility warning if farmer tested a specific crop
  let compatibilityWarning: string | null = null;
  if (intendedId !== 'help_me_decide' && intendedId in CROP_PROFILES) {
    const tested = scored.find((s) => s.crop_id === intendedId);
    if (tested && prevProfile && tested.crop_id === prevProfile.id) {
      compatibilityWarning = `Caution: Planting ${tested.name} right after ${prevProfile.name} repeats the same crop family, risking soil nutrient depletion and pest buildup. Consider ${best.name} instead.`;
    } else if (tested && tested.water_need === 'high' && isDry) {
      compatibilityWarning = `Caution: ${tested.name} needs steady moisture, but recent NASA 30-day rainfall is low (${rain30} mm) with ${dryDays} dry days. Wait for steady rains or choose ${best.name}.`;
    }
  }

  // Monthly NASA 20-year climatology planting calendar
  const monthsFallback = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthlyCalendar: RotationCalendarMonth[] = monthsFallback.map((mName, idx) => {
    const c = climatology[idx];
    const p = c?.precip_mm_day ?? null;
    const t = c?.temp_c ?? null;
    const g = c?.gwetroot ?? null;
    let suitability: RotationCalendarMonth['suitability'] = 'transitional';
    if (p !== null) {
      if (p >= 7.5 && (g ?? 0.6) >= 0.78) suitability = 'wet_risk';
      else if (p >= 2.6) suitability = 'optimal';
      else if (p >= 1.2) suitability = 'transitional';
      else suitability = 'dry';
    }
    return {
      month: c?.month ?? mName,
      monthIndex: idx + 1,
      precip_mm_day: p,
      temp_c: t,
      gwetroot: g,
      suitability,
    };
  });

  const nowMonthIdx = new Date().getUTCMonth(); // 0..11
  const currentMonth = monthlyCalendar[nowMonthIdx];
  const orderedUpcoming = [
    ...monthlyCalendar.slice(nowMonthIdx),
    ...monthlyCalendar.slice(0, nowMonthIdx),
  ];
  const optimalUpcoming = orderedUpcoming.filter((m) => m.suitability === 'optimal').slice(0, 3);
  const targetMonths =
    optimalUpcoming.length > 0
      ? optimalUpcoming.map((m) => m.month)
      : orderedUpcoming.filter((m) => m.suitability !== 'dry').slice(0, 2).map((m) => m.month);

  let windowStatus: CropRotationPlan['planting_window']['status'] = 'plant_now';
  let windowHeadline = '';
  let daysToWait: number | null = 0;
  let soilReadinessNote = '';
  let weatherTrigger = '';

  if (isWaterlogged) {
    windowStatus = 'delay_excess_water';
    daysToWait = 7;
    windowHeadline = 'Delay planting 5–10 days until excess surface water drains';
    soilReadinessNote = `Topsoil wetness is saturated (${Math.round(surfWet * 100)}%). Wait until soil crumbles cleanly without pooling water before seeding ${best.name}.`;
    weatherTrigger = 'Clear drainage channels and monitor 72-hour rainfall pause.';
  } else if (isDry) {
    const curIsOptimal = currentMonth?.suitability === 'optimal';
    windowStatus = curIsOptimal ? 'prepare_land' : 'wait_for_rain';
    daysToWait = outlook.trend_direction === 'wetting' ? 7 : 14;
    windowHeadline = `Wait for steady rainfall (~${daysToWait} days) — prepare land for ${best.name}`;
    soilReadinessNote = `Current root-zone moisture (${Math.round(rootWet * 100)}%) and ${dryDays} dry days increase germination risk. Prepare ridges and mulch now.`;
    weatherTrigger = `Target planting after 20+ mm of cumulative rain or in ${targetMonths[0] ?? 'upcoming wet window'}.`;
  } else if (currentMonth?.suitability === 'dry' && rain30 < 55) {
    windowStatus = 'prepare_land';
    daysToWait = 14;
    windowHeadline = `Prepare soil now — target ${targetMonths.join(' – ') || 'next rainy window'} to plant ${best.name}`;
    soilReadinessNote = `NASA 20-year climatology shows this month is normally dry (${currentMonth.precip_mm_day ?? '—'} mm/day). Conserve residue and pre-plan seed.`;
    weatherTrigger = `Best seasonal planting months from NASA climatology: ${targetMonths.join(', ') || 'check local onset'}.`;
  } else {
    windowStatus = 'plant_now';
    daysToWait = 0;
    windowHeadline = `Plant now — current moisture and temperature favor ${best.name}`;
    soilReadinessNote = `Root-zone wetness (${Math.round(rootWet * 100)}%) and 30-day rainfall (${rain30} mm) support healthy seed emergence.`;
    weatherTrigger = 'Verify moist soil 10 cm deep and plant within the next 3–7 days.';
  }

  // 3-season rotation sequence
  const followUpCrop: Exclude<CropId, 'help_me_decide'> =
    best.nitrogen_role === 'nitrogen_fixer'
      ? isWet
        ? 'rice'
        : 'maize'
      : 'cowpea';

  const threeSeasonSequence: CropRotationPlan['three_season_sequence'] = [
    {
      step_label: 'Season 1 (Previous / Current)',
      crop_id: prevProfile?.id ?? 'maize',
      crop_name: prevProfile?.name ?? 'Current / Fallow Plot',
      role_summary: prevProfile ? prevProfile.rotationSummaryEn.split('.')[0] : 'Baseline plot condition before next rotation.',
      timing_window: 'Completed / Active',
    },
    {
      step_label: 'Season 2 (Plant Next)',
      crop_id: best.crop_id,
      crop_name: best.name,
      role_summary: best.why_it_fits,
      timing_window: daysToWait === 0 ? 'Now (Next 3–7 days)' : `Target ${targetMonths[0] ?? `in ~${daysToWait} days`}`,
    },
    {
      step_label: 'Season 3 (Follow-Up Rotation)',
      crop_id: followUpCrop,
      crop_name: CROP_PROFILES[followUpCrop].name,
      role_summary:
        best.nitrogen_role === 'nitrogen_fixer'
          ? `Benefits from nitrogen left in the soil by ${best.name}.`
          : `Legume restores nitrogen and breaks pest cycles after ${best.name}.`,
      timing_window: targetMonths[1] ? `Follow-up (${targetMonths[1]}+)` : 'Next Major Season',
    },
  ];

  return {
    farm_id: farm.id,
    previous_crop_id: prevProfile?.id ?? null,
    recommended_crop_id: best.crop_id,
    recommended_crop_name: best.name,
    options: top3,
    compatibility_warning: compatibilityWarning,
    planting_window: {
      status: windowStatus,
      headline: windowHeadline,
      target_months: targetMonths,
      days_to_wait_estimate: daysToWait,
      soil_readiness_note: soilReadinessNote,
      weather_trigger: weatherTrigger,
    },
    monthly_calendar: monthlyCalendar,
    three_season_sequence: threeSeasonSequence,
    generated_at: new Date().toISOString(),
  };
}
