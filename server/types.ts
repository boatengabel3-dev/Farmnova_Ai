export type LanguageCode = 'en' | 'tw' | 'fr' | 'es' | 'pt' | 'sw' | 'hi' | 'ar';

export type HealthCategory =
  | 'Good conditions'
  | 'Watch carefully'
  | 'Needs attention'
  | 'Not enough information';

export type IntegrationStatus =
  | 'Connected'
  | 'Imagery Active'
  | 'Metadata Discovery'
  | 'Credentials Required'
  | 'Not yet connected'
  | 'Processing'
  | 'Unavailable';

export type CropId =
  | 'maize'
  | 'cassava'
  | 'yam'
  | 'rice'
  | 'groundnut'
  | 'cowpea'
  | 'soybean'
  | 'vegetables'
  | 'other'
  | 'help_me_decide';

export type PriorityId =
  | 'better_harvest'
  | 'less_water_stress'
  | 'lower_costs'
  | 'improve_soil'
  | 'try_another_crop';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface FarmRecord {
  id: string;
  owner_id: string;
  name: string;
  latitude: number;
  longitude: number;
  gps_accuracy_m: number | null;
  gps_recorded_at: string | null;
  is_at_farm: boolean | null;
  location_source: 'gps' | 'manual' | 'search' | 'demo';
  location_confirmed: boolean;
  boundary_geojson: GeoJsonPolygon | null;
  area_hectares: number | null;
  area_acres: number | null;
  community: string;
  district: string;
  region: string;
  country: string;
  size_category: string | null;
  previous_crop: CropId | null;
  intended_crop: CropId | null;
  priorities: PriorityId[];
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatasetProvenance {
  id: string;
  source: string;
  product_name: string;
  product_version: string;
  variables: string[];
  unit: string;
  native_resolution: string;
  processing_method: string;
  source_reference: string;
  integration_status: IntegrationStatus;
  status_detail: string;
  last_checked_at: string | null;
  priority_tier: 1 | 2 | 3;
}

export interface DailyObservation {
  date: string;
  PRECTOTCORR: number | null;
  T2M: number | null;
  T2M_MAX: number | null;
  T2M_MIN: number | null;
  GWETTOP: number | null;
  GWETROOT: number | null;
  GWETPROF: number | null;
  ALLSKY_SFC_SW_DWN: number | null;
  RH2M: number | null;
  WS2M: number | null;
  EVPTRNS: number | null;
  EVLAND: number | null;
}

export interface ClimateBaselineMonth {
  month: string;
  monthIndex: number;
  precip_mm_day: number | null;
  temp_c: number | null;
  gwetroot: number | null;
}

export interface EonetEventSummary {
  id: string;
  title: string;
  category: string;
  category_id: string;
  date: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  source_url: string;
}

export interface DisasterRiskItem {
  type: 'Drought & Dry-Spell Risk' | 'Flood & Waterlogging Risk' | 'Heat-Stress Risk' | 'Regional Hazard Proximity';
  level: 'Low' | 'Moderate' | 'Elevated';
  summary_en: string;
  summary_tw: string;
  evidence: string;
}

export interface SoilMoistureOutlook {
  current_root_wetness: number | null;
  projected_7d_wetness: number | null;
  projected_14d_wetness: number | null;
  net_water_balance_mm_day: number | null;
  trend_direction: 'drying' | 'stable' | 'wetting' | 'unknown';
  climate_rainfall_vs_normal_pct: number | null;
  climate_temp_vs_normal_c: number | null;
  next_month_climate_rain_mm_day: number | null;
  next_month_label: string;
  methodology_note: string;
  disaster_risks: DisasterRiskItem[];
  nearby_eonet_events: EonetEventSummary[];
}

export interface MeteomaticsSlot {
  valid_date: string;
  temp_c: number | null;
  precip_mm: number | null;
  humidity_pct: number | null;
  wind_ms: number | null;
  soil_water_5cm_m3m3: number | null;
  weather_symbol: number | null;
}

export interface MeteomaticsWeatherPayload {
  status: 'connected' | 'credentials_missing' | 'error';
  retrieved_at: string;
  current: MeteomaticsSlot | null;
  forecast_slots: MeteomaticsSlot[];
  next_72h_precip_mm: number | null;
  message: string;
}

export interface SupabaseEdgeSyncResult {
  configured: boolean;
  edge_url: string | null;
  status: 'invoked' | 'not_configured' | 'error';
  latency_ms: number | null;
  executed_at: string;
  message: string;
  edge_payload?: Record<string, unknown> | null;
}

export interface LandsatPrecisionScene {
  id: string;
  datetime: string;
  cloudCover: number | null;
  thumbnailUrl: string | null;
  browseUrl: string | null;
}

export interface FarmIndicators {
  farm_id: string;
  computed_at: string;
  observation_start: string | null;
  observation_end: string | null;
  days_count: number;
  rainfall_30d_mm: number | null;
  rainfall_prev30d_mm: number | null;
  rainfall_anomaly_pct: number | null;
  dry_spell_days: number | null;
  mean_temp_c: number | null;
  max_temp_c: number | null;
  heat_stress_days: number | null;
  surface_wetness_index: number | null;
  root_wetness_index: number | null;
  solar_radiation_mj: number | null;
  relative_humidity_pct: number | null;
  evapotranspiration_mm_day: number | null;
  elevation_m: number | null;
  slope_deg: number | null;
  health_category: HealthCategory;
  data_source_mode: 'live_nasa_power' | 'demonstration_cache' | 'unavailable';
  limitations: string[];
}

export interface RuleTraceItem {
  rule_id: string;
  title: string;
  outcome: 'matched' | 'caution' | 'context';
  detail: string;
}

export interface RecommendationRecord {
  id: string;
  farm_id: string;
  previous_crop: string | null;
  intended_crop: string | null;
  priority: string | null;
  suggested_crop: string;
  suggested_crop_id: CropId;
  headline_en: string;
  headline_tw: string;
  reason_en: string;
  reason_tw: string;
  next_actions_en: string[];
  next_actions_tw: string[];
  supporting_indicators: Array<{ label: string; value: string; source: string }>;
  limitations: string[];
  evidence_quality: string;
  rules_trace: RuleTraceItem[];
  created_at: string;
}

export interface IngestionRunRecord {
  id: string;
  farm_id: string;
  dataset_id: string;
  status: 'Success' | 'Failed' | 'Discovery Only' | 'Processing';
  started_at: string;
  finished_at: string | null;
  records_count: number;
  error_message: string | null;
}

export type GrowthStage = 'Land Prep' | 'Planted' | 'Vegetative' | 'Flowering' | 'Harvested';

export interface SeasonCycleRecord {
  id: string;
  farm_id: string;
  season_name: string;
  crop_id: CropId;
  planted_date: string;
  stage: GrowthStage;
  status: 'active' | 'completed';
  notes: string;
  harvest_outcome: string | null;
  nasa_rain_since_planting_mm: number | null;
  nasa_mean_temp_since_planting_c: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressLogRecord {
  id: string;
  farm_id: string;
  season_id: string | null;
  log_date: string;
  stage: GrowthStage;
  soil_feel: 'Dry' | 'Moist' | 'Wet' | 'Waterlogged';
  crop_condition: 'Thriving' | 'Normal' | 'Stressed';
  note: string;
  nasa_rain_7d_mm: number | null;
  nasa_wetness_snapshot: number | null;
  created_at: string;
}

export interface CropRotationOption {
  crop_id: Exclude<CropId, 'help_me_decide'>;
  name: string;
  family: string;
  nitrogen_role: 'heavy_feeder' | 'nitrogen_fixer' | 'moderate_feeder' | 'potassium_tuber';
  water_need: 'low' | 'moderate' | 'high';
  drought_tolerance: 'high' | 'moderate' | 'low';
  fit_score: number;
  fit_label: 'Best Rotation Match' | 'Strong Alternative' | 'Caution';
  why_it_fits: string;
  soil_benefit: string;
}

export interface RotationCalendarMonth {
  month: string;
  monthIndex: number;
  precip_mm_day: number | null;
  temp_c: number | null;
  gwetroot: number | null;
  suitability: 'optimal' | 'transitional' | 'dry' | 'wet_risk';
}

export interface CropRotationPlan {
  farm_id: string;
  previous_crop_id: CropId | null;
  recommended_crop_id: Exclude<CropId, 'help_me_decide'>;
  recommended_crop_name: string;
  options: CropRotationOption[];
  compatibility_warning: string | null;
  planting_window: {
    status: 'plant_now' | 'wait_for_rain' | 'delay_excess_water' | 'prepare_land';
    headline: string;
    target_months: string[];
    days_to_wait_estimate: number | null;
    soil_readiness_note: string;
    weather_trigger: string;
  };
  monthly_calendar: RotationCalendarMonth[];
  three_season_sequence: Array<{
    step_label: string;
    crop_id: CropId;
    crop_name: string;
    role_summary: string;
    timing_window: string;
  }>;
  generated_at: string;
}
