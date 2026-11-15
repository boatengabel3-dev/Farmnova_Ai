import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CloudRain,
  Droplets,
  ExternalLink,
  Flame,
  HelpCircle,
  MessageCircle,
  NotebookPen,
  Plus,
  RefreshCw,
  Satellite,
  ShieldAlert,
  Sprout,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  addProgressLog,
  createOrUpdateSeason,
  syncMeteomatics,
  syncNasaForFarm,
} from '../lib/api';
import { daysSinceCalendarDate, formatCalendarDate, formatUtcTimestamp, todayUtcIso } from '../lib/date';
import {
  CROP_CONDITION_LABELS,
  CROP_LABELS,
  getGreeting,
  GROWTH_STAGE_LABELS,
  HEALTH_LABELS,
  RISK_LEVEL_LABELS,
  SOIL_FEEL_LABELS,
  UI_COPY,
} from '../lib/i18n';
import type {
  ClimateBaselineMonth,
  CropId,
  CropRotationPlan,
  FarmIndicators,
  FarmRecord,
  GibsLayerSpec,
  GrowthStage,
  LandsatPrecisionScene,
  LanguageCode,
  MeteomaticsWeatherPayload,
  ProgressLogRecord,
  RecommendationRecord,
  SeasonCycleRecord,
  SoilMoistureOutlook,
} from '../types';
import { FarmMap } from './FarmMap';
import { CropIllustration } from './FarmovaIllustrations';
import { SpeakButton } from './SpeechPlayer';
import { useTranslatedList, useVoiceGuide, VoiceGuidedInput } from './VoiceGuidedField';

const CROP_OPTIONS: Exclude<CropId, 'help_me_decide'>[] = [
  'maize',
  'cassava',
  'yam',
  'rice',
  'groundnut',
  'cowpea',
  'soybean',
  'vegetables',
  'other',
];

const GROWTH_STAGES: GrowthStage[] = ['Land Prep', 'Planted', 'Vegetative', 'Flowering', 'Harvested'];
const SOIL_FEELS: Array<'Dry' | 'Moist' | 'Wet' | 'Waterlogged'> = ['Dry', 'Moist', 'Wet', 'Waterlogged'];
const CROP_CONDITIONS: Array<'Thriving' | 'Normal' | 'Stressed'> = ['Thriving', 'Normal', 'Stressed'];

interface FarmerDashboardProps {
  language: LanguageCode;
  farms: FarmRecord[];
  activeFarm: FarmRecord;
  indicators: FarmIndicators | null;
  recommendation: RecommendationRecord | null;
  outlook: SoilMoistureOutlook | null;
  climatology: ClimateBaselineMonth[];
  seasons: SeasonCycleRecord[];
  progressLogs: ProgressLogRecord[];
  meteomatics?: MeteomaticsWeatherPayload | null;
  landsatScenes?: LandsatPrecisionScene[];
  gibsLayers: GibsLayerSpec[];
  isOnline: boolean;
  cachedAt: string | null;
  onSelectFarm: (farmId: string) => void;
  onAddNewFarm: () => void;
  onOpenAlpha: () => void;
  onOpenCropRotation: () => void;
  onDataUpdated: (data: {
    farm?: FarmRecord;
    indicators?: FarmIndicators;
    recommendation?: RecommendationRecord;
    outlook?: SoilMoistureOutlook;
    rotationPlan?: CropRotationPlan;
    climatology?: ClimateBaselineMonth[];
    seasons?: SeasonCycleRecord[];
    progressLogs?: ProgressLogRecord[];
    meteomatics?: MeteomaticsWeatherPayload;
    landsatScenes?: LandsatPrecisionScene[];
  }) => void;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({
  language,
  farms,
  activeFarm,
  indicators,
  recommendation,
  outlook,
  seasons,
  progressLogs,
  meteomatics = null,
  landsatScenes = [],
  gibsLayers,
  isOnline,
  cachedAt,
  onSelectFarm,
  onAddNewFarm,
  onOpenAlpha,
  onOpenCropRotation,
  onDataUpdated,
}) => {
  const copy = UI_COPY[language];
  const { voiceGuideEnabled, setVoiceGuideEnabled } = useVoiceGuide();

  const [syncing, setSyncing] = useState(false);
  const [mmSyncing, setMmSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);

  // Field check-in state
  const activeSeason = seasons.find((s) => s.status === 'active') ?? seasons[0] ?? null;
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [checkStage, setCheckStage] = useState<GrowthStage>(activeSeason?.stage ?? 'Vegetative');
  const [checkSoilFeel, setCheckSoilFeel] = useState<'Dry' | 'Moist' | 'Wet' | 'Waterlogged'>('Moist');
  const [checkCondition, setCheckCondition] = useState<'Thriving' | 'Normal' | 'Stressed'>('Normal');
  const [checkNote, setCheckNote] = useState('');
  const [checkBusy, setCheckBusy] = useState(false);

  // New Season form state
  const [newSeasonCrop, setNewSeasonCrop] = useState<CropId>(
    recommendation?.suggested_crop_id ?? activeFarm.intended_crop ?? 'maize'
  );
  const [newSeasonDate, setNewSeasonDate] = useState(() => todayUtcIso());
  const [newSeasonName, setNewSeasonName] = useState('');
  const [seasonBusy, setSeasonBusy] = useState(false);

  const health = indicators?.health_category ?? 'Not enough information';
  const healthMeta = HEALTH_LABELS[health];

  const healthStyles = {
    good: 'bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]/25',
    watch: 'bg-[#E3A72F]/20 text-[#6F4B05] border-[#E3A72F]/45',
    attention: 'bg-[#A2461F]/12 text-[#A2461F] border-[#A2461F]/30',
    unknown: 'bg-black/5 text-black/70 border-black/15',
  }[healthMeta.tone];

  const HealthIcon =
    healthMeta.tone === 'good'
      ? CheckCircle2
      : healthMeta.tone === 'unknown'
      ? HelpCircle
      : AlertTriangle;

  // Prepare raw English/Twi texts and translate dynamically for all other global languages
  const baseHeadline = recommendation
    ? language === 'tw'
      ? recommendation.headline_tw
      : recommendation.headline_en
    : 'Preparing your farm guidance...';
  const baseReason = recommendation
    ? language === 'tw'
      ? recommendation.reason_tw
      : recommendation.reason_en
    : '';
  const baseSolutions = recommendation
    ? language === 'tw'
      ? recommendation.next_actions_tw
      : recommendation.next_actions_en
    : [];
  const baseRisks = outlook?.disaster_risks ?? [];

  const textsToTranslate = useMemo(() => {
    if (language === 'en' || language === 'tw') return [];
    return [
      baseHeadline,
      baseReason,
      ...baseSolutions,
      ...baseRisks.map((r) => r.summary_en),
      ...baseRisks.map((r) => r.type),
    ];
  }, [baseHeadline, baseReason, baseRisks, baseSolutions, language]);

  const translatedStrings = useTranslatedList(textsToTranslate, language);

  const headline =
    language === 'en' || language === 'tw' ? baseHeadline : translatedStrings[0] || baseHeadline;
  const reason =
    language === 'en' || language === 'tw' ? baseReason : translatedStrings[1] || baseReason;
  const solutionItems =
    language === 'en' || language === 'tw'
      ? baseSolutions
      : baseSolutions.map((s, idx) => translatedStrings[2 + idx] || s);

  const riskStartIdx = 2 + baseSolutions.length;
  const riskSummaries =
    language === 'en' || language === 'tw'
      ? baseRisks.map((r) => (language === 'tw' ? r.summary_tw : r.summary_en))
      : baseRisks.map((r, idx) => translatedStrings[riskStartIdx + idx] || r.summary_en);
  const riskTitles =
    language === 'en' || language === 'tw'
      ? baseRisks.map((r) => r.type)
      : baseRisks.map((r, idx) => translatedStrings[riskStartIdx + baseRisks.length + idx] || r.type);

  // Derive concise Problem-Specific Solution steps from live risk levels
  const problemSpecificSolutions = useMemo(() => {
    const items: string[] = [...solutionItems];
    const drought = baseRisks.find((r) => r.type === 'Drought & Dry-Spell Risk');
    const flood = baseRisks.find((r) => r.type === 'Flood & Waterlogging Risk');
    const heat = baseRisks.find((r) => r.type === 'Heat-Stress Risk');

    if (drought && drought.level !== 'Low' && language === 'en') {
      items.push('Apply dry grass or crop residue mulch around plant bases to hold root moisture longer.');
    }
    if (flood && flood.level !== 'Low' && language === 'en') {
      items.push('Clear field drainage trenches along low edges before heavy rain pools around roots.');
    }
    if (heat && heat.level !== 'Low' && language === 'en') {
      items.push('Water young seedlings early in the morning or late evening to cut evaporation loss.');
    }
    return items.slice(0, 5);
  }, [baseRisks, language, solutionItems]);

  const spokenSummary = `${headline}. ${reason} ${problemSpecificSolutions.join('. ')}`;

  const handleRefreshAdvice = async () => {
    if (!isOnline) {
      setSyncMessage(copy.offlineNotice);
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncNasaForFarm(activeFarm.id);
      onDataUpdated({
        indicators: res.indicators,
        recommendation: res.recommendation,
        outlook: res.outlook,
        rotationPlan: res.rotationPlan,
        climatology: res.climatology,
        seasons: res.seasons,
        meteomatics: res.meteomatics,
        landsatScenes: res.landsatScenes,
      });
      setSyncMessage(
        res.nasaSync.success
          ? `Synced live NASA POWER (${res.nasaSync.recordsCount} days), Landsat scenes, and EONET hazards.`
          : `Could not reach NASA POWER right now (${res.nasaSync.error ?? 'network timeout'}).`
      );
    } catch {
      setSyncMessage('Unable to refresh right now. Showing last saved observations.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncMeteomatics = async () => {
    if (!isOnline) return;
    setMmSyncing(true);
    try {
      const res = await syncMeteomatics(activeFarm.id);
      onDataUpdated({ meteomatics: res.meteomatics });
    } catch {
      setSyncMessage('Could not reach Meteomatics live weather right now.');
    } finally {
      setMmSyncing(false);
    }
  };

  const handleStageTap = async (stage: GrowthStage) => {
    if (!activeSeason || !isOnline) return;
    setSeasonBusy(true);
    try {
      const res = await createOrUpdateSeason(activeFarm.id, {
        seasonId: activeSeason.id,
        stage,
      });
      onDataUpdated({ seasons: res.seasons });
    } catch {
      setSyncMessage('Could not update crop stage right now.');
    } finally {
      setSeasonBusy(false);
    }
  };

  const handleStartNewSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setSyncMessage(copy.offlineNotice);
      return;
    }
    setSeasonBusy(true);
    try {
      const res = await createOrUpdateSeason(activeFarm.id, {
        crop_id: newSeasonCrop,
        planted_date: newSeasonDate,
        season_name: newSeasonName.trim() || undefined,
        stage: 'Planted',
        markPriorCompleted: true,
      });
      onDataUpdated({ seasons: res.seasons });
      setShowNewSeasonModal(false);
      setNewSeasonName('');
    } catch {
      setSyncMessage('Could not create new season right now.');
    } finally {
      setSeasonBusy(false);
    }
  };

  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setSyncMessage(copy.offlineNotice);
      return;
    }
    setCheckBusy(true);
    try {
      const res = await addProgressLog(activeFarm.id, {
        season_id: activeSeason?.id ?? null,
        stage: checkStage,
        soil_feel: checkSoilFeel,
        crop_condition: checkCondition,
        note: checkNote.trim(),
      });
      onDataUpdated({
        progressLogs: res.progressLogs,
        seasons: res.seasons,
      });
      setCheckNote('');
      setShowCheckInForm(false);
    } catch {
      setSyncMessage('Could not save field check-in right now.');
    } finally {
      setCheckBusy(false);
    }
  };

  const formattedUpdatedAt = formatUtcTimestamp(indicators?.computed_at ?? cachedAt ?? activeFarm.updated_at);
  const daysSincePlanting = daysSinceCalendarDate(activeSeason?.planted_date);
  const moisturePct = (v: number | null | undefined) => (v !== null && v !== undefined ? Math.round(v * 100) : null);
  const wetNow = moisturePct(outlook?.current_root_wetness ?? indicators?.root_wetness_index);
  const wet7 = moisturePct(outlook?.projected_7d_wetness);
  const wet14 = moisturePct(outlook?.projected_14d_wetness);

  // Active problems sorted so Elevated/Moderate appear clearly first
  const prioritizedProblems = [...baseRisks]
    .map((risk, idx) => ({ risk, localizedTitle: riskTitles[idx], localizedSummary: riskSummaries[idx] }))
    .sort((a, b) => {
      const order = { Elevated: 0, Moderate: 1, Low: 2 };
      return order[a.risk.level] - order[b.risk.level];
    });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-24 sm:pb-12 space-y-6">
      {/* Farm Selector & Voice Guide Control Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#1F5A2E]">{getGreeting(language)}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tracking-tight">
            {activeFarm.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-black/65">
            <span>{activeFarm.community || `${activeFarm.latitude.toFixed(2)}°, ${activeFarm.longitude.toFixed(2)}°`}</span>
            {activeFarm.region && (
              <>
                <span aria-hidden="true">·</span>
                <span>{activeFarm.region}</span>
              </>
            )}
            {activeFarm.country && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#1A1A1A]">{activeFarm.country}</span>
              </>
            )}
            {activeFarm.area_acres && (
              <>
                <span aria-hidden="true">·</span>
                <span>{activeFarm.area_acres} acres ({activeFarm.area_hectares} ha)</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {farms.length > 1 && (
            <select
              value={activeFarm.id}
              onChange={(e) => onSelectFarm(e.target.value)}
              aria-label="Select farm"
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-black/15 bg-white text-sm font-medium text-[#1A1A1A]"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.country ? `(${f.country})` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setVoiceGuideEnabled(!voiceGuideEnabled)}
            className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              voiceGuideEnabled
                ? 'bg-[#1F5A2E]/10 border-[#1F5A2E]/30 text-[#1F5A2E]'
                : 'bg-white border-black/15 text-black/70'
            }`}
          >
            {voiceGuideEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{voiceGuideEnabled ? copy.voiceGuideOn : copy.voiceGuideOff}</span>
          </button>
          <button
            type="button"
            onClick={onAddNewFarm}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-white border border-black/15 text-sm font-semibold text-[#1F5A2E] hover:bg-black/5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Farm</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3.5 rounded-xl bg-white border border-black/10 text-sm text-[#1A1A1A]">
          {syncMessage}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. WHAT'S HAPPENING ON YOUR FARM                                      */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-3xl border border-black/10 p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1A1A1A]">{copy.whatsHappeningTitle}</h2>
            <p className="text-xs text-black/60 mt-0.5">{copy.whatsHappeningSubtitle}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold ${healthStyles}`}>
              <HealthIcon className="w-4 h-4 shrink-0" />
              <span>{healthMeta[language]}</span>
            </div>
            <SpeakButton text={spokenSummary} language={language} />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-bold text-[#1A1A1A] leading-snug text-balance">
            {headline}
          </h3>
          {reason && <p className="text-sm sm:text-base text-black/75 leading-relaxed">{reason}</p>}
        </div>

        <div className="grid sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-[#F6EFE0]/65 border border-black/10">
            <div className="flex items-center gap-1.5 text-xs text-black/60">
              <CloudRain className="w-3.5 h-3.5" />
              <span>30d Rainfall (NASA)</span>
            </div>
            <div className="text-lg font-bold font-mono-tabular text-[#1A1A1A] mt-1">
              {indicators?.rainfall_30d_mm !== null && indicators?.rainfall_30d_mm !== undefined
                ? `${indicators.rainfall_30d_mm} mm`
                : '—'}
            </div>
            {outlook?.climate_rainfall_vs_normal_pct !== null && outlook?.climate_rainfall_vs_normal_pct !== undefined && (
              <div className="text-[11px] font-mono-tabular text-black/65">
                {outlook.climate_rainfall_vs_normal_pct > 0 ? '+' : ''}
                {outlook.climate_rainfall_vs_normal_pct}% vs 20yr norm
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F6EFE0]/65 border border-black/10">
            <div className="flex items-center gap-1.5 text-xs text-black/60">
              <Thermometer className="w-3.5 h-3.5" />
              <span>Mean Temp (30d)</span>
            </div>
            <div className="text-lg font-bold font-mono-tabular text-[#1A1A1A] mt-1">
              {indicators?.mean_temp_c !== null && indicators?.mean_temp_c !== undefined
                ? `${indicators.mean_temp_c}°C`
                : '—'}
            </div>
            <div className="text-[11px] font-mono-tabular text-black/65">
              Max {indicators?.max_temp_c ?? '—'}°C
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F6EFE0]/65 border border-black/10">
            <div className="flex items-center gap-1.5 text-xs text-black/60">
              <Droplets className="w-3.5 h-3.5" />
              <span>Root Soil Wetness</span>
            </div>
            <div className="text-lg font-bold font-mono-tabular text-[#1F5A2E] mt-1">
              {wetNow !== null ? `${wetNow}%` : '—'}
            </div>
            <div className="text-[11px] text-black/65 inline-flex items-center gap-1">
              {outlook?.trend_direction === 'drying' ? (
                <TrendingDown className="w-3 h-3 text-[#A2461F]" />
              ) : (
                <TrendingUp className="w-3 h-3 text-[#1F5A2E]" />
              )}
              <span>
                7d: {wet7 !== null ? `${wet7}%` : '—'} · 14d: {wet14 !== null ? `${wet14}%` : '—'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F6EFE0]/65 border border-black/10">
            <div className="flex items-center gap-1.5 text-xs text-black/60">
              <Sprout className="w-3.5 h-3.5" />
              <span>Active Crop Stage</span>
            </div>
            <div className="text-base font-bold text-[#1A1A1A] mt-1 truncate">
              {activeSeason
                ? `${CROP_LABELS[activeSeason.crop_id]?.[language] ?? activeSeason.crop_id}`
                : 'No active crop'}
            </div>
            <div className="text-[11px] text-black/65">
              {activeSeason
                ? `${GROWTH_STAGE_LABELS[activeSeason.stage]?.[language] ?? activeSeason.stage}${daysSincePlanting !== null ? ` · ${daysSincePlanting}d` : ''}`
                : 'Tap Start New Season below'}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. PROBLEMS & RISKS + 3. SOLUTIONS (SIDE BY SIDE)                     */}
      {/* ===================================================================== */}
      <div className="grid lg:grid-cols-2 gap-5 items-stretch">
        {/* 2. PROBLEMS */}
        <section className="bg-white rounded-3xl border border-black/10 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">{copy.problemsTitle}</h2>
                <p className="text-xs text-black/60 mt-0.5">{copy.problemsSubtitle}</p>
              </div>
              <ShieldAlert className="w-5 h-5 text-[#A2461F] shrink-0" />
            </div>

            <div className="space-y-2.5">
              {prioritizedProblems.map(({ risk, localizedTitle, localizedSummary }) => {
                const badgeStyle =
                  risk.level === 'Elevated'
                    ? 'bg-[#A2461F]/12 text-[#A2461F] border-[#A2461F]/30'
                    : risk.level === 'Moderate'
                    ? 'bg-[#E3A72F]/20 text-[#6F4B05] border-[#E3A72F]/45'
                    : 'bg-[#1F5A2E]/10 text-[#1F5A2E] border-[#1F5A2E]/25';

                return (
                  <div key={risk.type} className="p-3.5 rounded-2xl border border-black/10 bg-[#F6EFE0]/35 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-[#1A1A1A]">{localizedTitle}</span>
                      <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold whitespace-nowrap ${badgeStyle}`}>
                        {RISK_LEVEL_LABELS[risk.level][language]}
                      </span>
                    </div>
                    <p className="text-xs text-black/75 leading-relaxed">{localizedSummary}</p>
                    <div className="text-[11px] font-mono-tabular text-black/50">{risk.evidence}</div>
                  </div>
                );
              })}
            </div>

            {outlook && outlook.nearby_eonet_events.length > 0 && (
              <div className="pt-2 border-t border-black/10 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#A2461F]">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Nearby NASA EONET Natural Hazards (≤600 km)</span>
                </div>
                {outlook.nearby_eonet_events.slice(0, 2).map((ev) => (
                  <a
                    key={ev.id}
                    href={ev.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 text-xs p-2 rounded-xl bg-[#A2461F]/5 hover:bg-[#A2461F]/10 text-[#1A1A1A]"
                  >
                    <span className="truncate font-medium">
                      {ev.title} ({ev.category})
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#A2461F] font-semibold shrink-0">
                      {ev.distance_km} km
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 3. SOLUTIONS */}
        <section className="bg-white rounded-3xl border border-black/10 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">{copy.solutionsTitle}</h2>
                <p className="text-xs text-black/60 mt-0.5">{copy.solutionsSubtitle}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-[#1F5A2E] shrink-0" />
            </div>

            <ul className="space-y-2.5">
              {problemSpecificSolutions.map((sol, idx) => (
                <li key={idx} className="p-3.5 rounded-2xl bg-[#F6EFE0]/45 border border-black/10 flex items-start gap-3 text-sm text-[#1A1A1A]">
                  <span className="w-6 h-6 rounded-full bg-[#1F5A2E] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{sol}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-black/10 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenCropRotation}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#1F5A2E] text-white text-xs font-semibold hover:bg-[#194A25] whitespace-nowrap cursor-pointer"
            >
              <Sprout className="w-4 h-4" />
              <span>{copy.cropRotationNav}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenAlpha}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-black/15 bg-white text-xs font-semibold text-[#1A1A1A] hover:bg-black/5 whitespace-nowrap cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-[#1F5A2E]" />
              <span>{copy.askAlpha}</span>
            </button>
          </div>
        </section>
      </div>

      {/* ===================================================================== */}
      {/* 4. LIVE UPDATES ON THE FARM                                           */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-3xl border border-black/10 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1A1A1A]">{copy.liveUpdatesTitle}</h2>
            <p className="text-xs text-black/60 mt-0.5">
              {copy.liveUpdatesSubtitle} · {copy.lastUpdated}: {formattedUpdatedAt}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncMeteomatics}
              disabled={mmSyncing || !isOnline}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-black/15 bg-white text-xs font-semibold text-[#1F5A2E] hover:bg-black/5 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <CloudRain className="w-3.5 h-3.5" />
              <span>{mmSyncing ? 'Checking Weather...' : 'Sync Live Weather'}</span>
            </button>
            <button
              type="button"
              onClick={handleRefreshAdvice}
              disabled={syncing || !isOnline}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1F5A2E] text-white text-xs font-semibold hover:bg-[#194A25] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing NASA...' : 'Sync Live NASA Data'}</span>
            </button>
          </div>
        </div>

        {/* Live Meteomatics Weather + Live Farm Map */}
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 space-y-3">
            <div className="p-4 rounded-2xl border border-black/10 bg-[#F6EFE0]/45 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wide text-[#1F5A2E]">
                  Live Weather Update (Meteomatics 72h Forecast)
                </div>
                <span className="text-[11px] font-mono-tabular text-black/60">
                  {meteomatics?.status === 'connected' ? 'Live' : 'Standby'}
                </span>
              </div>

              {meteomatics?.status === 'connected' && meteomatics.current ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-black/10">
                    <div className="text-black/55">Temp Now</div>
                    <div className="font-bold font-mono-tabular text-base text-[#1A1A1A]">{meteomatics.current.temp_c ?? '—'}°C</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-black/10">
                    <div className="text-black/55">Precip 1h</div>
                    <div className="font-bold font-mono-tabular text-base text-[#1A1A1A]">{meteomatics.current.precip_mm ?? 0} mm</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-black/10">
                    <div className="text-black/55">Humidity</div>
                    <div className="font-bold font-mono-tabular text-base text-[#1A1A1A]">{meteomatics.current.humidity_pct ?? '—'}%</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-black/10">
                    <div className="text-black/55">Soil -5cm</div>
                    <div className="font-bold font-mono-tabular text-sm text-[#1A1A1A]">
                      {meteomatics.current.soil_water_5cm_m3m3 !== null
                        ? `${meteomatics.current.soil_water_5cm_m3m3} m³/m³`
                        : '—'}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-black/70">
                  {meteomatics?.message ?? 'Tap "Sync Live Weather" to pull current temperature, rainfall, and 72-hour forecast.'}
                </p>
              )}

              {meteomatics?.next_72h_precip_mm !== null && meteomatics?.next_72h_precip_mm !== undefined && (
                <div className="text-xs font-mono-tabular text-black/70">
                  Expected rainfall over next 72 hours: <strong>{meteomatics.next_72h_precip_mm} mm</strong>
                </div>
              )}
            </div>

            {/* Latest 30m Landsat Satellite Pass */}
            {landsatScenes.length > 0 && (
              <div className="p-4 rounded-2xl border border-black/10 bg-white flex items-center gap-3.5">
                {landsatScenes[0].thumbnailUrl && (
                  <img
                    src={landsatScenes[0].thumbnailUrl}
                    alt={landsatScenes[0].id}
                    className="w-16 h-16 rounded-xl object-cover border border-black/10 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0 flex-1 text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#1F5A2E]">
                    <Satellite className="w-3.5 h-3.5" />
                    <span>Latest NASA/USGS 30m Satellite Scene</span>
                  </div>
                  <div className="font-mono-tabular text-[#1A1A1A] truncate">{landsatScenes[0].id}</div>
                  <div className="text-black/60">
                    {formatCalendarDate(landsatScenes[0].datetime)} · Cloud {landsatScenes[0].cloudCover ?? '?'}%
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6">
            <FarmMap
              latitude={activeFarm.latitude}
              longitude={activeFarm.longitude}
              gpsAccuracyM={activeFarm.gps_accuracy_m}
              boundary={activeFarm.boundary_geojson}
              gibsLayers={gibsLayers}
              showLayerPicker
              heightClass="h-64"
            />
          </div>
        </div>

        {/* Live Field Stage & Check-In Updates */}
        <div className="pt-4 border-t border-black/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-sm text-[#1A1A1A]">
              Live Field Progress & Ground Check-Ins
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCheckInForm((v) => !v)}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#1F5A2E] text-white text-xs font-semibold hover:bg-[#194A25] cursor-pointer"
              >
                <NotebookPen className="w-3.5 h-3.5" />
                <span>Log Field Check-In</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewSeasonModal(true)}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl border border-black/15 bg-white text-xs font-semibold text-[#1A1A1A] hover:bg-black/5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Start New Season</span>
              </button>
            </div>
          </div>

          {activeSeason && (
            <div className="p-4 rounded-2xl bg-[#F6EFE0]/55 border border-black/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-black/10 flex items-center justify-center shrink-0">
                    <CropIllustration crop={activeSeason.crop_id} className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#1A1A1A]">{activeSeason.season_name}</div>
                    <div className="text-xs text-black/60">
                      Planted {formatCalendarDate(activeSeason.planted_date)} · NASA Rain:{' '}
                      {activeSeason.nasa_rain_since_planting_mm ?? '—'} mm
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {GROWTH_STAGES.map((st, idx) => {
                  const activeIdx = GROWTH_STAGES.indexOf(activeSeason.stage);
                  const isCurrent = st === activeSeason.stage;
                  const isReached = idx <= activeIdx;
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={seasonBusy || !isOnline}
                      onClick={() => handleStageTap(st)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border text-center transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#1F5A2E] text-white border-[#1F5A2E]'
                          : isReached
                          ? 'bg-[#1F5A2E]/12 text-[#1F5A2E] border-[#1F5A2E]/25'
                          : 'bg-white text-black/65 border-black/10 hover:bg-black/5'
                      }`}
                    >
                      {GROWTH_STAGE_LABELS[st][language]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showCheckInForm && (
            <form onSubmit={handleSubmitCheckIn} className="p-5 rounded-2xl bg-[#F6EFE0]/45 border border-black/15 space-y-4">
              <div className="font-bold text-sm text-[#1A1A1A]">
                Record Live Field Observation
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">Growth Stage</label>
                  <select
                    value={checkStage}
                    onChange={(e) => setCheckStage(e.target.value as GrowthStage)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-black/15 bg-white text-sm"
                  >
                    {GROWTH_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {GROWTH_STAGE_LABELS[s][language]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">Topsoil Feel</label>
                  <select
                    value={checkSoilFeel}
                    onChange={(e) => setCheckSoilFeel(e.target.value as typeof checkSoilFeel)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-black/15 bg-white text-sm"
                  >
                    {SOIL_FEELS.map((sf) => (
                      <option key={sf} value={sf}>
                        {SOIL_FEEL_LABELS[sf][language]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">Crop Condition</label>
                  <select
                    value={checkCondition}
                    onChange={(e) => setCheckCondition(e.target.value as typeof checkCondition)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-black/15 bg-white text-sm"
                  >
                    {CROP_CONDITIONS.map((cc) => (
                      <option key={cc} value={cc}>
                        {CROP_CONDITION_LABELS[cc][language]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black/70 mb-1">Field Note</label>
                <VoiceGuidedInput
                  fieldKey="checkin_note"
                  value={checkNote}
                  onValueChange={setCheckNote}
                  placeholder="e.g. Leaves deep green, weeded plot edges, steady soil moisture"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckInForm(false)}
                  className="min-h-[40px] px-4 rounded-xl border border-black/15 bg-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkBusy}
                  className="min-h-[40px] px-5 rounded-xl bg-[#1F5A2E] text-white text-xs font-semibold hover:bg-[#194A25] disabled:opacity-50 cursor-pointer"
                >
                  {checkBusy ? 'Saving...' : 'Save Check-In'}
                </button>
              </div>
            </form>
          )}

          {progressLogs.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {progressLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="p-3.5 rounded-2xl border border-black/10 bg-[#F6EFE0]/30 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 font-semibold text-[#1A1A1A]">
                    <span>
                      {formatCalendarDate(log.log_date)} · {GROWTH_STAGE_LABELS[log.stage]?.[language] ?? log.stage}
                    </span>
                    <span className="text-[#1F5A2E]">
                      {SOIL_FEEL_LABELS[log.soil_feel][language]} · {CROP_CONDITION_LABELS[log.crop_condition][language]}
                    </span>
                  </div>
                  {log.note && <p className="text-black/75">{log.note}</p>}
                  <div className="text-[11px] font-mono-tabular text-black/50">
                    NASA 7d rain: {log.nasa_rain_7d_mm ?? '—'} mm · Root wetness:{' '}
                    {log.nasa_wetness_snapshot !== null ? `${Math.round(log.nasa_wetness_snapshot * 100)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Start New Season Modal */}
      {showNewSeasonModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <form
            onSubmit={handleStartNewSeason}
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-black/15 p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#1A1A1A]">Start a New Planting Season</h2>
              <button
                type="button"
                onClick={() => setShowNewSeasonModal(false)}
                className="w-10 h-10 rounded-xl bg-[#F6EFE0] flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-1">Crop Planted</label>
                <select
                  value={newSeasonCrop}
                  onChange={(e) => setNewSeasonCrop(e.target.value as CropId)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-black/15 bg-[#F6EFE0]/40 text-sm font-medium"
                >
                  {CROP_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CROP_LABELS[c][language]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-1">Planting Date</label>
                <VoiceGuidedInput
                  fieldKey="planting_date"
                  type="date"
                  value={newSeasonDate}
                  onValueChange={setNewSeasonDate}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-1">Season Label (optional)</label>
                <VoiceGuidedInput
                  fieldKey="season_label"
                  value={newSeasonName}
                  onValueChange={setNewSeasonName}
                  placeholder="e.g. Long Rains 2026 — Cowpea"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={seasonBusy}
              className="w-full min-h-[48px] rounded-xl bg-[#1F5A2E] text-white font-semibold text-base hover:bg-[#194A25] disabled:opacity-60 cursor-pointer"
            >
              {seasonBusy ? 'Starting season...' : 'Start Tracking Season'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
