import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  RefreshCw,
  Sprout,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { computeRotationPlan, createOrUpdateSeason } from '../lib/api';
import { todayUtcIso } from '../lib/date';
import { CROP_LABELS, PRIORITY_LABELS, UI_COPY } from '../lib/i18n';
import type {
  CropId,
  CropRotationPlan,
  FarmIndicators,
  FarmRecord,
  LanguageCode,
  PriorityId,
  RecommendationRecord,
  SeasonCycleRecord,
  SoilMoistureOutlook,
} from '../types';
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

const PRIORITY_OPTIONS: PriorityId[] = [
  'improve_soil',
  'less_water_stress',
  'better_harvest',
  'lower_costs',
  'try_another_crop',
];

interface CropRotationPageProps {
  language: LanguageCode;
  activeFarm: FarmRecord;
  rotationPlan: CropRotationPlan | null;
  indicators: FarmIndicators | null;
  outlook: SoilMoistureOutlook | null;
  isOnline: boolean;
  onPlanUpdated: (patch: {
    farm?: FarmRecord;
    rotationPlan?: CropRotationPlan;
    recommendation?: RecommendationRecord;
    outlook?: SoilMoistureOutlook;
    indicators?: FarmIndicators;
    seasons?: SeasonCycleRecord[];
  }) => void;
  onGoToGuide: () => void;
}

export const CropRotationPage: React.FC<CropRotationPageProps> = ({
  language,
  activeFarm,
  rotationPlan,
  indicators,
  outlook,
  isOnline,
  onPlanUpdated,
  onGoToGuide,
}) => {
  const copy = UI_COPY[language];
  const { voiceGuideEnabled, setVoiceGuideEnabled } = useVoiceGuide();

  const [prevCrop, setPrevCrop] = useState<CropId>(activeFarm.previous_crop ?? 'maize');
  const [intendedCrop, setIntendedCrop] = useState<CropId>(activeFarm.intended_crop ?? 'help_me_decide');
  const [priority, setPriority] = useState<PriorityId>(activeFarm.priorities?.[0] ?? 'improve_soil');
  const [recalcBusy, setRecalcBusy] = useState(false);

  // Start season / save rotation state
  const [selectedCropToPlant, setSelectedCropToPlant] = useState<CropId>(
    rotationPlan?.recommended_crop_id ?? activeFarm.intended_crop ?? 'cowpea'
  );
  const [plantingDate, setPlantingDate] = useState<string>(() => todayUtcIso());
  const [seasonLabel, setSeasonLabel] = useState<string>('');
  const [rotationNote, setRotationNote] = useState<string>('');
  const [savingSeason, setSavingSeason] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    setPrevCrop(activeFarm.previous_crop ?? 'maize');
    setIntendedCrop(activeFarm.intended_crop ?? 'help_me_decide');
    setPriority(activeFarm.priorities?.[0] ?? 'improve_soil');
  }, [activeFarm.id, activeFarm.previous_crop, activeFarm.intended_crop, activeFarm.priorities]);

  useEffect(() => {
    if (rotationPlan?.recommended_crop_id) {
      setSelectedCropToPlant(rotationPlan.recommended_crop_id);
    }
  }, [rotationPlan?.recommended_crop_id]);

  // Translate dynamic plan prose when language is non-English
  const dynamicTexts = useMemo(() => {
    if (!rotationPlan) return [];
    return [
      rotationPlan.planting_window.headline,
      rotationPlan.planting_window.soil_readiness_note,
      rotationPlan.planting_window.weather_trigger,
      rotationPlan.compatibility_warning ?? '',
      ...rotationPlan.options.map((o) => o.why_it_fits),
      ...rotationPlan.options.map((o) => o.soil_benefit),
      ...rotationPlan.three_season_sequence.map((s) => s.role_summary),
    ];
  }, [rotationPlan]);

  const localizedTexts = useTranslatedList(dynamicTexts, language);

  const windowHeadline = localizedTexts[0] || rotationPlan?.planting_window.headline || '';
  const soilReadinessNote = localizedTexts[1] || rotationPlan?.planting_window.soil_readiness_note || '';
  const weatherTrigger = localizedTexts[2] || rotationPlan?.planting_window.weather_trigger || '';
  const compatibilityWarning =
    rotationPlan?.compatibility_warning ? localizedTexts[3] || rotationPlan.compatibility_warning : null;

  const optStart = 4;
  const optLen = rotationPlan?.options.length ?? 0;
  const optionReasons = localizedTexts.slice(optStart, optStart + optLen);
  const optionBenefits = localizedTexts.slice(optStart + optLen, optStart + optLen * 2);
  const sequenceSummaries = localizedTexts.slice(optStart + optLen * 2);

  const handleTestRotation = async (saveToFarm = false) => {
    if (!isOnline) {
      setStatusNotice(copy.offlineNotice);
      return;
    }
    setRecalcBusy(true);
    setStatusNotice(null);
    try {
      const res = await computeRotationPlan(activeFarm.id, {
        previous_crop: prevCrop,
        intended_crop: intendedCrop,
        priorities: [priority],
        saveToFarm,
      });
      onPlanUpdated({
        rotationPlan: res.rotationPlan,
        recommendation: res.recommendation,
        outlook: res.outlook,
        indicators: res.indicators,
      });
      if (saveToFarm) {
        setStatusNotice('Rotation preferences saved to your farm.');
      }
    } catch {
      setStatusNotice('Unable to recalculate rotation plan right now.');
    } finally {
      setRecalcBusy(false);
    }
  };

  const handleStartRotationSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setStatusNotice(copy.offlineNotice);
      return;
    }
    setSavingSeason(true);
    setStatusNotice(null);
    try {
      const cropName = CROP_LABELS[selectedCropToPlant]?.[language] ?? selectedCropToPlant;
      const res = await createOrUpdateSeason(activeFarm.id, {
        crop_id: selectedCropToPlant,
        planted_date: plantingDate,
        season_name: seasonLabel.trim() || `${cropName} (${plantingDate.slice(0, 7)})`,
        stage: rotationPlan?.planting_window.status === 'plant_now' ? 'Planted' : 'Land Prep',
        notes: rotationNote.trim(),
        markPriorCompleted: true,
      });
      onPlanUpdated({ seasons: res.seasons });
      setSeasonLabel('');
      setRotationNote('');
      setStatusNotice('Next crop season saved! Live tracking is active on Farmer Guide.');
    } catch {
      setStatusNotice('Could not save this crop rotation season.');
    } finally {
      setSavingSeason(false);
    }
  };

  const spokenRotationSummary = rotationPlan
    ? `${CROP_LABELS[rotationPlan.recommended_crop_id]?.[language] ?? rotationPlan.recommended_crop_name}. ${optionReasons[0] ?? ''} ${windowHeadline}. ${soilReadinessNote}`
    : copy.rotationPageSubtitle;

  const windowTone =
    rotationPlan?.planting_window.status === 'plant_now'
      ? 'bg-[#1F5A2E] text-white'
      : rotationPlan?.planting_window.status === 'delay_excess_water'
      ? 'bg-[#A2461F] text-white'
      : 'bg-[#E3A72F]/22 text-[#1A1A1A] border border-[#E3A72F]/50';

  const currentUtcMonth = new Date().getUTCMonth() + 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-24 sm:pb-12 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#1F5A2E]">
            {activeFarm.name} · {activeFarm.community || activeFarm.country || 'Global Farm'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tracking-tight text-balance">
            {copy.rotationPageTitle}
          </h1>
          <p className="text-sm text-black/70 max-w-2xl">{copy.rotationPageSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setVoiceGuideEnabled(!voiceGuideEnabled)}
            className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              voiceGuideEnabled
                ? 'bg-[#1F5A2E]/10 border-[#1F5A2E]/30 text-[#1F5A2E]'
                : 'bg-white border-black/15 text-black/70'
            }`}
          >
            {voiceGuideEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{voiceGuideEnabled ? copy.voiceGuideOn : copy.voiceGuideOff}</span>
          </button>
          <SpeakButton text={spokenRotationSummary} language={language} />
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-2xl bg-white border border-[#1F5A2E]/30 text-sm text-[#1A1A1A] flex flex-wrap items-center justify-between gap-3">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={onGoToGuide}
            className="text-xs font-bold text-[#1F5A2E] underline cursor-pointer"
          >
            {copy.farmerView} →
          </button>
        </div>
      )}

      {/* Primary 2-Column Decision: WHAT to Plant + WHEN to Plant */}
      {rotationPlan ? (
        <div className="grid lg:grid-cols-2 gap-5 items-stretch">
          {/* Card A: WHAT TO PLANT NEXT */}
          <section className="bg-white rounded-3xl border border-black/10 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#1F5A2E]">
                  {copy.whatToPlantTitle}
                </span>
                <Sprout className="w-5 h-5 text-[#1F5A2E]" />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#F6EFE0] border border-black/10 flex items-center justify-center shrink-0">
                  <CropIllustration crop={rotationPlan.recommended_crop_id} className="w-12 h-12" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
                    {CROP_LABELS[rotationPlan.recommended_crop_id]?.[language] ?? rotationPlan.recommended_crop_name}
                  </h2>
                  <div className="text-xs text-black/65 mt-0.5">
                    {rotationPlan.options[0]?.family} · {optionBenefits[0] ?? rotationPlan.options[0]?.soil_benefit}
                  </div>
                </div>
              </div>

              <p className="text-sm text-black/80 leading-relaxed">
                {optionReasons[0] ?? rotationPlan.options[0]?.why_it_fits}
              </p>

              {compatibilityWarning && (
                <div className="p-3.5 rounded-2xl bg-[#A2461F]/10 border border-[#A2461F]/30 text-xs text-[#A2461F] flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{compatibilityWarning}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-xs text-black/60">
              <span>
                Previous crop:{' '}
                <strong className="text-[#1A1A1A]">
                  {rotationPlan.previous_crop_id
                    ? CROP_LABELS[rotationPlan.previous_crop_id]?.[language] ?? rotationPlan.previous_crop_id
                    : 'Not recorded'}
                </strong>
              </span>
              <span className="font-mono-tabular font-semibold text-[#1F5A2E]">
                Match Score: {rotationPlan.options[0]?.fit_score ?? 85}/100
              </span>
            </div>
          </section>

          {/* Card B: WHEN TO PLANT NEXT */}
          <section className="bg-white rounded-3xl border border-black/10 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#A2461F]">
                  {copy.whenToPlantTitle}
                </span>
                <Clock className="w-5 h-5 text-[#A2461F]" />
              </div>

              <div className={`p-4 rounded-2xl ${windowTone} space-y-1.5`}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-90">
                  {rotationPlan.planting_window.status === 'plant_now' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  <span>
                    {rotationPlan.planting_window.days_to_wait_estimate === 0
                      ? 'Ready to Plant'
                      : `Target Window: ${rotationPlan.planting_window.target_months.join(' – ') || 'Next Rain'}`}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold leading-snug">{windowHeadline}</h2>
              </div>

              <p className="text-sm text-black/80 leading-relaxed">{soilReadinessNote}</p>

              <div className="p-3.5 rounded-2xl bg-[#F6EFE0]/60 border border-black/10 text-xs text-[#1A1A1A] flex items-start gap-2">
                <Droplets className="w-4 h-4 text-[#1F5A2E] shrink-0 mt-0.5" />
                <span>{weatherTrigger}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-xs text-black/60 font-mono-tabular">
              <span>
                30d Rain: {indicators?.rainfall_30d_mm ?? '—'} mm · Dry Spell: {indicators?.dry_spell_days ?? '—'}d
              </span>
              <span>
                14d Wetness: {outlook?.projected_14d_wetness !== null && outlook?.projected_14d_wetness !== undefined ? `${Math.round(outlook.projected_14d_wetness * 100)}%` : '—'}
              </span>
            </div>
          </section>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-black/10 p-8 text-center text-sm text-black/65">
          Sync NASA data on the Farmer Guide to generate your planting calendar and crop rotation plan.
        </div>
      )}

      {/* Interactive Rotation Scenario Tester + Top 3 Options */}
      <section className="bg-white rounded-3xl border border-black/10 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Compare Rotation Options for Your Plot</h2>
          <button
            type="button"
            onClick={() => handleTestRotation(true)}
            disabled={recalcBusy || !isOnline}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#1F5A2E] text-white text-xs font-semibold hover:bg-[#194A25] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalcBusy ? 'animate-spin' : ''}`} />
            <span>{recalcBusy ? 'Calculating...' : 'Update & Save Rotation'}</span>
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-black/70 mb-1">{copy.lastSeason}</label>
            <select
              value={prevCrop}
              onChange={(e) => setPrevCrop(e.target.value as CropId)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-black/15 bg-[#F6EFE0]/40 text-sm font-medium"
            >
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CROP_LABELS[c][language]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 mb-1">{copy.growNext}</label>
            <select
              value={intendedCrop}
              onChange={(e) => setIntendedCrop(e.target.value as CropId)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-black/15 bg-[#F6EFE0]/40 text-sm font-medium"
            >
              <option value="help_me_decide">{CROP_LABELS.help_me_decide[language]}</option>
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CROP_LABELS[c][language]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-black/70 mb-1">{copy.whatMatters}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityId)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-black/15 bg-[#F6EFE0]/40 text-sm font-medium"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p][language]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rotationPlan && (
          <div className="grid md:grid-cols-3 gap-3.5 pt-2">
            {rotationPlan.options.map((opt, idx) => (
              <button
                key={opt.crop_id}
                type="button"
                onClick={() => setSelectedCropToPlant(opt.crop_id)}
                className={`p-4 rounded-2xl border text-left transition-colors space-y-2.5 cursor-pointer ${
                  selectedCropToPlant === opt.crop_id
                    ? 'border-[#1F5A2E] bg-[#1F5A2E]/8'
                    : 'border-black/10 bg-[#F6EFE0]/30 hover:bg-[#F6EFE0]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <CropIllustration crop={opt.crop_id} className="w-9 h-9 shrink-0" />
                    <div>
                      <div className="font-bold text-base text-[#1A1A1A]">
                        {CROP_LABELS[opt.crop_id]?.[language] ?? opt.name}
                      </div>
                      <div className="text-[11px] text-black/55">{opt.family}</div>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs font-bold text-[#1F5A2E]">
                    {opt.fit_score}%
                  </span>
                </div>

                <p className="text-xs text-black/75 leading-relaxed">
                  {optionReasons[idx] ?? opt.why_it_fits}
                </p>

                <div className="text-[11px] text-black/60 pt-1 border-t border-black/10 flex items-center justify-between gap-2">
                  <span>{optionBenefits[idx] ?? opt.soil_benefit}</span>
                  <span>Water: {opt.water_need}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 12-Month NASA Climatology Planting Calendar */}
      {rotationPlan && (
        <section className="bg-white rounded-3xl border border-black/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#1F5A2E]">
                NASA POWER 20-Year Monthly Baseline
              </div>
              <h2 className="text-lg font-bold text-[#1A1A1A] mt-0.5">{copy.plantingCalendarTitle}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-black/65">
              <span>Optimal Planting</span>
              <span>·</span>
              <span>Transitional</span>
              <span>·</span>
              <span>Dry / Land Prep</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2">
            {rotationPlan.monthly_calendar.map((m) => {
              const isNow = m.monthIndex === currentUtcMonth;
              const style =
                m.suitability === 'optimal'
                  ? 'bg-[#1F5A2E]/12 border-[#1F5A2E]/35 text-[#1F5A2E]'
                  : m.suitability === 'wet_risk'
                  ? 'bg-[#A2461F]/12 border-[#A2461F]/35 text-[#A2461F]'
                  : m.suitability === 'transitional'
                  ? 'bg-[#E3A72F]/18 border-[#E3A72F]/45 text-[#6F4B05]'
                  : 'bg-[#F6EFE0]/60 border-black/10 text-black/65';

              return (
                <div
                  key={m.month}
                  className={`p-2.5 rounded-2xl border text-center space-y-1 ${style} ${
                    isNow ? 'ring-2 ring-[#1A1A1A]' : ''
                  }`}
                >
                  <div className="text-xs font-bold font-mono-tabular">
                    {m.month} {isNow ? '•' : ''}
                  </div>
                  <div className="text-[11px] font-mono-tabular font-semibold">
                    {m.precip_mm_day !== null ? `${m.precip_mm_day.toFixed(1)}mm/d` : '—'}
                  </div>
                  <div className="text-[10px] font-mono-tabular opacity-80">
                    {m.temp_c !== null ? `${m.temp_c.toFixed(0)}°C` : '—'}
                  </div>
                  <div className="text-[10px] font-semibold capitalize">
                    {m.suitability === 'wet_risk' ? 'Heavy rain' : m.suitability}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3-Season Crop Rotation Timeline + Lock In Season Form */}
      <div className="grid lg:grid-cols-12 gap-5">
        {rotationPlan && (
          <section className="lg:col-span-6 bg-white rounded-3xl border border-black/10 p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">{copy.rotationSequenceTitle}</h2>
            <div className="space-y-3">
              {rotationPlan.three_season_sequence.map((step, idx) => (
                <div key={step.step_label} className="p-4 rounded-2xl bg-[#F6EFE0]/50 border border-black/10 flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-black/10 flex items-center justify-center shrink-0">
                    <CropIllustration crop={step.crop_id} className="w-8 h-8" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/55">
                      <span className="font-semibold">{step.step_label}</span>
                      <span className="font-mono-tabular text-[#1F5A2E] font-semibold">{step.timing_window}</span>
                    </div>
                    <div className="font-bold text-base text-[#1A1A1A]">
                      {CROP_LABELS[step.crop_id]?.[language] ?? step.crop_name}
                    </div>
                    <p className="text-xs text-black/75 leading-relaxed">
                      {sequenceSummaries[idx] ?? step.role_summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Voice-Guided Lock In Next Crop Form */}
        <section className="lg:col-span-6 bg-white rounded-3xl border border-black/10 p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#1A1A1A]">{copy.startNextSeasonBtn}</h2>
            <p className="text-xs text-black/65">
              Tap any text box below and the voice guide will help you in your selected language.
            </p>
          </div>

          <form onSubmit={handleStartRotationSeason} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-black/75 mb-1">Next Crop to Plant</label>
              <select
                value={selectedCropToPlant}
                onChange={(e) => setSelectedCropToPlant(e.target.value as CropId)}
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
              <label className="block text-xs font-semibold text-black/75 mb-1">Target / Actual Planting Date</label>
              <VoiceGuidedInput
                fieldKey="planting_date"
                type="date"
                value={plantingDate}
                onValueChange={setPlantingDate}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-black/75 mb-1">Season Label (optional)</label>
              <VoiceGuidedInput
                fieldKey="season_label"
                value={seasonLabel}
                onValueChange={setSeasonLabel}
                placeholder="e.g. Main Rains 2026 — Cowpea"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-black/75 mb-1">Land Prep & Seed Note (optional)</label>
              <VoiceGuidedInput
                fieldKey="rotation_note"
                value={rotationNote}
                onValueChange={setRotationNote}
                placeholder="e.g. Leave maize stalks as mulch before sowing"
              />
            </div>

            <button
              type="submit"
              disabled={savingSeason || !isOnline}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-xl bg-[#1F5A2E] text-white font-semibold text-sm hover:bg-[#194A25] disabled:opacity-50 cursor-pointer"
            >
              <span>{savingSeason ? 'Saving...' : copy.startNextSeasonBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
