import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Globe,
  MapPin,
  Mic,
  MicOff,
  Search,
  Sparkles,
} from 'lucide-react';
import { createFarm, fetchLocations, transcribeAudio } from '../lib/api';
import { CROP_LABELS, getLanguageMeta, PRIORITY_LABELS, UI_COPY } from '../lib/i18n';
import {
  clearOnboardingDraft,
  enqueueOfflineSync,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft,
} from '../lib/offlineCache';
import type {
  ClimateBaselineMonth,
  CropId,
  CropRotationPlan,
  FarmIndicators,
  FarmRecord,
  GeoJsonPolygon,
  GibsLayerSpec,
  GlobalLocationEntry,
  LandsatPrecisionScene,
  LanguageCode,
  MeteomaticsWeatherPayload,
  PriorityId,
  RecommendationRecord,
  SoilMoistureOutlook,
} from '../types';
import { FarmMap } from './FarmMap';
import { CropIllustration, FarmSizeIllustration } from './FarmovaIllustrations';
import { SpeakButton } from './SpeechPlayer';
import { useTranslatedList, VoiceGuidedInput } from './VoiceGuidedField';

const PREVIOUS_CROPS: CropId[] = [
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

const PRIORITIES: PriorityId[] = [
  'better_harvest',
  'less_water_stress',
  'lower_costs',
  'improve_soil',
  'try_another_crop',
];

interface FarmerOnboardingProps {
  language: LanguageCode;
  gibsLayers: GibsLayerSpec[];
  isOnline: boolean;
  onComplete: (result: {
    farm: FarmRecord;
    indicators?: FarmIndicators;
    recommendation?: RecommendationRecord;
    outlook?: SoilMoistureOutlook;
    rotationPlan?: CropRotationPlan;
    climatology?: ClimateBaselineMonth[];
    meteomatics?: MeteomaticsWeatherPayload;
    landsatScenes?: LandsatPrecisionScene[];
    queuedOffline?: boolean;
  }) => void;
  onCancel?: () => void;
  onUseDemoFarm?: () => void;
}

const DEFAULT_DRAFT: OnboardingDraft = {
  step: 0,
  name: '',
  latitude: null,
  longitude: null,
  gps_accuracy_m: null,
  gps_recorded_at: null,
  is_at_farm: null,
  location_source: 'manual',
  location_confirmed: false,
  boundary_geojson: null,
  area_hectares: null,
  area_acres: null,
  community: '',
  district: '',
  region: '',
  country: '',
  size_category: null,
  previous_crop: null,
  intended_crop: null,
  priorities: [],
};

export const FarmerOnboarding: React.FC<FarmerOnboardingProps> = ({
  language,
  gibsLayers,
  isOnline,
  onComplete,
  onCancel,
  onUseDemoFarm,
}) => {
  const copy = UI_COPY[language];
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({ ...DEFAULT_DRAFT, ...(loadOnboardingDraft() ?? {}) }));
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<GlobalLocationEntry[]>([]);
  const [showBoundaryEditor, setShowBoundaryEditor] = useState(false);
  const [showCoordInput, setShowCoordInput] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [sizeUnit, setSizeUnit] = useState<'acres' | 'hectares'>('acres');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listeningCrop, setListeningCrop] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const translatedUi = useTranslatedList(
    useMemo(
      () => [
        'Use your device GPS anywhere in the world',
        'Search farming hubs worldwide, enter coordinates, or tap the global map',
        'Where is your farm located?',
        'Search any region or country (e.g. Nakuru, Iowa, Pune, Sorriso, Ejura...)',
        'Tap anywhere on the global NASA map or enter coordinates',
        'Enter Lat / Lon',
        'Draw boundary corners',
        'Farm name (optional)',
        'Community / Town',
        'Country',
        'Say Crop Name',
        'See My Farm Advice',
        'Retrieving live NASA observations...',
        'Pick one or more, or skip to see your guidance.',
      ],
      []
    ),
    language
  );
  const [
    gpsDescT,
    manualDescT,
    whereFarmT,
    searchPlaceholderT,
    mapHelpT,
    enterLatLonT,
    drawBoundaryT,
    farmNameLabelT,
    communityLabelT,
    countryLabelT,
    sayCropLabelT,
    seeAdviceLabelT,
    retrievingNasaT,
    pickPrioritiesT,
  ] = translatedUi;

  useEffect(() => {
    saveOnboardingDraft(draft);
  }, [draft]);

  useEffect(() => {
    fetchLocations(searchQuery)
      .then(setLocations)
      .catch(() => {
        setLocations([
          { community: 'Ejura', district: 'Ejura-Sekyedumase', region: 'Ashanti', country: 'Ghana', latitude: 7.3825, longitude: -1.3602, agroZone: 'Tropical Forest-Savanna Transition' },
          { community: 'Nakuru', district: 'Nakuru County', region: 'Rift Valley', country: 'Kenya', latitude: -0.3031, longitude: 36.08, agroZone: 'Tropical Highland Sub-Humid' },
          { community: 'Pune (Baramati)', district: 'Pune District', region: 'Maharashtra', country: 'India', latitude: 18.1506, longitude: 74.5772, agroZone: 'Tropical Semi-Arid Monsoon' },
          { community: 'Ames (Story County)', district: 'Iowa', region: 'Midwest', country: 'United States', latitude: 42.0308, longitude: -93.6319, agroZone: 'Temperate Continental Cropland' },
          { community: 'Sorriso', district: 'Mato Grosso', region: 'Center-West', country: 'Brazil', latitude: -12.5425, longitude: -55.7211, agroZone: 'Tropical Cerrado Savanna' },
          { community: 'Mekong Delta (Can Tho)', district: 'Can Tho', region: 'Mekong Delta', country: 'Vietnam', latitude: 10.0452, longitude: 105.7469, agroZone: 'Tropical Humid Delta' },
        ]);
      });
  }, [searchQuery]);

  const updateDraft = (patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleRequestGps = () => {
    setGpsError(null);
    if (!('geolocation' in navigator)) {
      setGpsError(
        language === 'tw'
          ? 'W’afidie yi ntumi nhwehwɛ GPS. Hwehwɛ kuro anaa kyerɛ wo baabi wɔ asase mfonini so.'
          : 'Location service is unavailable on this browser. Search any city worldwide or pick coordinates below.'
      );
      updateDraft({ step: 1, location_source: 'manual', latitude: 7.3825, longitude: -1.3602 });
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        updateDraft({
          step: 1,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          gps_accuracy_m: Number(pos.coords.accuracy.toFixed(1)),
          gps_recorded_at: new Date(pos.timestamp).toISOString(),
          location_source: 'gps',
          is_at_farm: null,
          location_confirmed: false,
        });
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(
          err.code === 1
            ? language === 'tw'
              ? 'Woamma GPS kwan. Hwehwɛ baabi a w’afuw wɔ wɔ aseɛ ha.'
              : 'Location permission was declined. No problem — search any region worldwide or mark your farm on the map.'
            : language === 'tw'
            ? 'Yɛantumi anhu baabi a wowɔ ntɛm. Hwehwɛ w’afuw kuro wɔ aseɛ ha.'
            : 'Could not lock GPS signal right now. Search any global farming region or drop a pin on the map.'
        );
        updateDraft({
          step: 1,
          location_source: 'manual',
          is_at_farm: false,
          latitude: draft.latitude ?? 7.3825,
          longitude: draft.longitude ?? -1.3602,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const handleSelectGlobalLocation = (loc: GlobalLocationEntry) => {
    updateDraft({
      latitude: loc.latitude,
      longitude: loc.longitude,
      community: loc.community,
      district: loc.district,
      region: loc.region,
      country: loc.country,
      location_source: 'search',
      location_confirmed: true,
      name: draft.name || `${loc.community} Farm`,
    });
  };

  const handleJumpToCoords = () => {
    const la = Number(manualLat);
    const lo = Number(manualLon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
      return;
    }
    updateDraft({
      latitude: Number(la.toFixed(6)),
      longitude: Number(lo.toFixed(6)),
      location_source: 'manual',
      location_confirmed: true,
    });
  };

  const matchSpokenCrop = (spokenText: string) => {
    const t = spokenText.toLowerCase();
    const map: Array<[RegExp, CropId]> = [
      [/maize|corn|aburo/, 'maize'],
      [/cassava|bankye/, 'cassava'],
      [/yam|bayere|bayerɛ/, 'yam'],
      [/rice|emo|ɛmo/, 'rice'],
      [/groundnut|peanut|nkatee/, 'groundnut'],
      [/cowpea|bean|adua|ayewa/, 'cowpea'],
      [/soy/, 'soybean'],
      [/tomato|pepper|okra|vegetable|ntos|mako|nkruma/, 'vegetables'],
    ];
    for (const [rx, id] of map) {
      if (rx.test(t)) return id;
    }
    return null;
  };

  const handleVoiceCropCapture = async () => {
    setVoiceNote(null);
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        setListeningCrop(true);
        const rec = new SpeechRec() as {
          lang: string;
          interimResults: boolean;
          onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
          onerror: () => void;
          onend: () => void;
          start: () => void;
        };
        rec.lang = getLanguageMeta(language).speechLang;
        rec.interimResults = false;
        rec.onresult = (e) => {
          const text = e.results?.[0]?.[0]?.transcript ?? '';
          const matched = matchSpokenCrop(text);
          if (matched) {
            updateDraft({ previous_crop: matched });
            setVoiceNote(`Heard "${text}" → selected ${CROP_LABELS[matched][language]}.`);
          } else {
            setVoiceNote(`Heard "${text}". Please tap a crop picture below to confirm.`);
          }
        };
        rec.onerror = () => {
          setVoiceNote(
            language === 'tw'
              ? 'Yɛante nne no yiye. Yɛsrɛ wo, mia afifideɛ mfonini no so.'
              : 'Could not catch the crop name clearly — tap a crop card below instead.'
          );
          setListeningCrop(false);
        };
        rec.onend = () => setListeningCrop(false);
        rec.start();
        return;
      } catch {
        setListeningCrop(false);
      }
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        setListeningCrop(true);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => chunks.push(ev.data);
        recorder.onstop = async () => {
          stream.getTracks().forEach((tr) => tr.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const b64 = String(reader.result).split(',')[1] ?? '';
            try {
              const res = await transcribeAudio({
                audioBase64: b64,
                mimeType: blob.type,
                language,
              });
              const matched = matchSpokenCrop(res.transcript);
              if (matched) {
                updateDraft({ previous_crop: matched });
                setVoiceNote(`Heard "${res.transcript}" → selected ${CROP_LABELS[matched][language]}.`);
              } else {
                setVoiceNote(`Heard "${res.transcript}". Tap a crop picture below to confirm.`);
              }
            } catch {
              setVoiceNote('Voice recognition unavailable — tap any crop picture below.');
            }
            setListeningCrop(false);
          };
          reader.readAsDataURL(blob);
        };
        recorder.start();
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 3500);
      } catch {
        setListeningCrop(false);
        setVoiceNote('Microphone access unavailable — tap any crop picture below.');
      }
    } else {
      setVoiceNote('Microphone unavailable on this device — tap any crop picture below.');
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const lat = draft.latitude ?? 7.3825;
    const lon = draft.longitude ?? -1.3602;
    const payload: Record<string, unknown> = {
      name: draft.name.trim() || (draft.community ? `${draft.community} Farm` : draft.country ? `${draft.country} Farm` : 'My Farm'),
      latitude: lat,
      longitude: lon,
      gps_accuracy_m: draft.gps_accuracy_m,
      gps_recorded_at: draft.gps_recorded_at,
      is_at_farm: draft.is_at_farm,
      location_source: draft.location_source,
      location_confirmed: draft.location_confirmed,
      boundary_geojson: draft.boundary_geojson,
      area_hectares: draft.area_hectares,
      area_acres: draft.area_acres,
      community: draft.community,
      district: draft.district,
      region: draft.region,
      country: draft.country,
      size_category: draft.size_category,
      previous_crop: draft.previous_crop,
      intended_crop: draft.intended_crop ?? 'help_me_decide',
      priorities: draft.priorities,
      language,
    };

    if (!isOnline) {
      enqueueOfflineSync({ type: 'create_farm', payload });
      const offlineFarm: FarmRecord = {
        id: `local-${Date.now()}`,
        owner_id: 'local',
        name: String(payload.name),
        latitude: lat,
        longitude: lon,
        gps_accuracy_m: draft.gps_accuracy_m,
        gps_recorded_at: draft.gps_recorded_at,
        is_at_farm: draft.is_at_farm,
        location_source: draft.location_source,
        location_confirmed: draft.location_confirmed,
        boundary_geojson: draft.boundary_geojson,
        area_hectares: draft.area_hectares,
        area_acres: draft.area_acres,
        community: draft.community,
        district: draft.district,
        region: draft.region,
        country: draft.country,
        size_category: draft.size_category,
        previous_crop: draft.previous_crop,
        intended_crop: draft.intended_crop ?? 'help_me_decide',
        priorities: draft.priorities,
        is_demo: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      clearOnboardingDraft();
      setSubmitting(false);
      onComplete({ farm: offlineFarm, queuedOffline: true });
      return;
    }

    try {
      const res = await createFarm(payload);
      clearOnboardingDraft();
      setSubmitting(false);
      onComplete(res);
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'Could not save farm. Try again.');
    }
  };

  const sizeOptions = useMemo(
    () => [
      {
        id: 'small',
        tier: 'small' as const,
        acres: 'Under 1 acre',
        hectares: 'Under 0.4 ha',
        acresVal: 0.75,
        haVal: 0.3,
        tw: 'Ketewa (nsateaa 1 ase)',
      },
      {
        id: 'medium',
        tier: 'medium' as const,
        acres: '1 to 5 acres',
        hectares: '0.4 to 2 ha',
        acresVal: 2.5,
        haVal: 1.0,
        tw: 'Mfinimfini (nsateaa 1–5)',
      },
      {
        id: 'large',
        tier: 'large' as const,
        acres: 'More than 5 acres',
        hectares: 'More than 2 ha',
        acresVal: 6.5,
        haVal: 2.6,
        tw: 'Kɛse (nsateaa 5 boro so)',
      },
    ],
    []
  );

  const stepPromptSpeech = useMemo(() => {
    if (draft.step === 0) return `${copy.letsFindFarm} ${copy.findFarmExplain}`;
    if (draft.step === 1) return draft.location_source === 'gps' && draft.is_at_farm === null ? copy.areYouAtFarm : copy.letsFindFarm;
    if (draft.step === 2) return copy.howBig;
    if (draft.step === 3) return copy.lastSeason;
    if (draft.step === 4) return copy.growNext;
    return copy.whatMatters;
  }, [copy, draft.is_at_farm, draft.location_source, draft.step]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Progress & Audio Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {draft.step > 0 ? (
            <button
              type="button"
              onClick={() => updateDraft({ step: Math.max(0, draft.step - 1) })}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-black/15 bg-white text-sm font-medium text-[#1A1A1A] hover:bg-black/5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{copy.backBtn}</span>
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-black/15 bg-white text-sm font-medium text-[#1A1A1A] hover:bg-black/5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{copy.backBtn}</span>
            </button>
          ) : null}
          <span className="text-sm font-medium text-black/60">
            Step {draft.step + 1} of 6
          </span>
        </div>

        <SpeakButton text={stepPromptSpeech} language={language} />
      </div>

      {/* Step Indicator Bar */}
      <div className="grid grid-cols-6 gap-1.5 mb-8">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-colors ${
              i <= draft.step ? 'bg-[#1F5A2E]' : 'bg-black/10'
            }`}
          />
        ))}
      </div>

      {/* STEP 0: Welcome & Location Choice */}
      {draft.step === 0 && (
        <div className="bg-white rounded-3xl border border-black/10 p-6 sm:p-10 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F5A2E]">
              <Globe className="w-4 h-4" />
              <span>Global NASA Earth-Observation Coverage</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight">
              {copy.letsFindFarm}
            </h1>
            <p className="text-base sm:text-lg text-black/75 leading-relaxed max-w-xl">
              {copy.findFarmExplain}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <button
              type="button"
              onClick={handleRequestGps}
              disabled={gpsLoading}
              className="flex flex-col items-start gap-3 p-5 rounded-2xl bg-[#1F5A2E] text-white hover:bg-[#194A25] transition-colors text-left min-h-[120px] cursor-pointer"
            >
              <Compass className="w-7 h-7 text-[#E3A72F]" />
              <div>
                <div className="text-lg font-semibold">
                  {gpsLoading ? (language === 'tw' ? 'Ɛrehwehwɛ baabi a wowɔ...' : 'Finding your location...') : copy.allowLocation}
                </div>
                <div className="text-sm text-white/80 mt-1">
                  {language === 'tw'
                    ? 'Fa w’afidie GPS kyerɛ baabi a wowɔ seesei'
                    : gpsDescT}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                updateDraft({
                  step: 1,
                  location_source: 'manual',
                  is_at_farm: false,
                  latitude: draft.latitude ?? 7.3825,
                  longitude: draft.longitude ?? -1.3602,
                })
              }
              className="flex flex-col items-start gap-3 p-5 rounded-2xl bg-[#F6EFE0] border border-black/15 text-[#1A1A1A] hover:bg-[#EFE5CF] transition-colors text-left min-h-[120px] cursor-pointer"
            >
              <MapPin className="w-7 h-7 text-[#A2461F]" />
              <div>
                <div className="text-lg font-semibold">{copy.enterManual}</div>
                <div className="text-sm text-black/70 mt-1">
                  {language === 'tw'
                    ? 'Hwehwɛ kuro wɔ wiase afanaa biara anaa kyerɛ wɔ mfonini so'
                    : manualDescT}
                </div>
              </div>
            </button>
          </div>

          {onUseDemoFarm && (
            <div className="pt-4 border-t border-black/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-black/65">
                {language === 'tw'
                  ? 'Wopɛ sɛ wohwɛ nhwɛso afuw bi ansa?'
                  : 'Want to explore first? Try the sample farm before creating your own.'}
              </span>
              <button
                type="button"
                onClick={onUseDemoFarm}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-black/15 text-sm font-semibold text-[#1F5A2E] hover:bg-[#1F5A2E]/5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{language === 'tw' ? 'Hwɛ Nhwɛso Afuw (Ejura)' : 'Open Sample Farm (Ejura)'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 1: Confirm Location Check & Optional Boundary */}
      {draft.step === 1 && (
        <div className="bg-white rounded-3xl border border-black/10 p-6 sm:p-8 space-y-6">
          {gpsError && (
            <div className="p-4 rounded-xl bg-[#E3A72F]/15 border border-[#E3A72F]/40 text-sm text-[#1A1A1A]">
              {gpsError}
            </div>
          )}

          {draft.location_source === 'gps' && draft.is_at_farm === null && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">{copy.areYouAtFarm}</h2>
              <p className="text-sm text-black/70">
                {language === 'tw'
                  ? 'Sɛ wote fie anaa kuro mu a, mma yɛnfa baabi a wote no nyɛ w’afuw.'
                  : 'If you are at home or in town, we will help you move the pin to your actual farm land.'}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateDraft({ is_at_farm: true, location_confirmed: true })}
                  className="min-h-[52px] px-5 py-3 rounded-xl bg-[#1F5A2E] text-white font-semibold text-base hover:bg-[#194A25] cursor-pointer"
                >
                  {copy.yesAtFarm}
                </button>
                <button
                  type="button"
                  onClick={() => updateDraft({ is_at_farm: false, location_confirmed: false })}
                  className="min-h-[52px] px-5 py-3 rounded-xl bg-[#F6EFE0] border border-black/15 text-[#1A1A1A] font-semibold text-base hover:bg-[#EFE5CF] cursor-pointer"
                >
                  {copy.noElsewhere}
                </button>
              </div>
            </div>
          )}

          {/* Global Location Search when Manual or Not at Farm */}
          {(draft.is_at_farm === false || draft.location_source !== 'gps') && (
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">
                {language === 'tw' ? 'Kyerɛ baabi a w’afuw wɔ' : whereFarmT}
              </h2>
              <VoiceGuidedInput
                fieldKey="location_search"
                value={searchQuery}
                onValueChange={setSearchQuery}
                leftIcon={<Search className="w-4 h-4" />}
                placeholder={
                  language === 'tw'
                    ? 'Hwehwɛ kuro anaa ɔman (sɛ Nakuru, Pune, Iowa, Ejura...)'
                    : searchPlaceholderT
                }
                className="bg-[#F6EFE0]/50"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {locations.slice(0, 12).map((loc) => {
                  const selected = draft.community === loc.community && draft.country === loc.country;
                  return (
                    <button
                      key={`${loc.community}-${loc.country}-${loc.latitude}`}
                      type="button"
                      onClick={() => handleSelectGlobalLocation(loc)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#1F5A2E] bg-[#1F5A2E]/10'
                          : 'border-black/10 bg-white hover:bg-[#F6EFE0]/60'
                      }`}
                    >
                      <div className="font-semibold text-sm text-[#1A1A1A] truncate">{loc.community}</div>
                      <div className="text-xs text-black/60 truncate">
                        {loc.region ? `${loc.region}, ` : ''}{loc.country}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive NASA Global Map + Optional Coordinates & Boundary Editor */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[#1A1A1A]">
                {language === 'tw'
                  ? 'Tap asase mfonini so anaa twa w’afuw ano hye'
                  : mapHelpT}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCoordInput((v) => !v)}
                  className="text-xs font-semibold text-[#A2461F] underline underline-offset-4 cursor-pointer"
                >
                  {showCoordInput ? 'Hide coordinates' : enterLatLonT}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBoundaryEditor((v) => !v)}
                  className="text-xs font-semibold text-[#1F5A2E] underline underline-offset-4 cursor-pointer"
                >
                  {showBoundaryEditor ? 'Hide boundary drawing' : drawBoundaryT}
                </button>
              </div>
            </div>

            {showCoordInput && (
              <div className="p-3.5 rounded-2xl bg-[#F6EFE0]/70 border border-black/10 grid sm:grid-cols-3 gap-2.5 items-start">
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">Latitude (-90 to 90)</label>
                  <VoiceGuidedInput
                    fieldKey="latitude"
                    type="number"
                    step="0.0001"
                    value={manualLat}
                    onValueChange={setManualLat}
                    placeholder={String(draft.latitude ?? 7.3825)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">Longitude (-180 to 180)</label>
                  <VoiceGuidedInput
                    fieldKey="longitude"
                    type="number"
                    step="0.0001"
                    value={manualLon}
                    onValueChange={setManualLon}
                    placeholder={String(draft.longitude ?? -1.3602)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleJumpToCoords}
                  className="sm:mt-5 min-h-[44px] px-4 rounded-xl bg-[#1F5A2E] text-white text-xs font-semibold hover:bg-[#194A25] cursor-pointer"
                >
                  Move Pin Here
                </button>
              </div>
            )}

            <FarmMap
              latitude={draft.latitude ?? 7.3825}
              longitude={draft.longitude ?? -1.3602}
              gpsAccuracyM={draft.is_at_farm ? draft.gps_accuracy_m : null}
              boundary={draft.boundary_geojson}
              gibsLayers={gibsLayers}
              editablePoint
              editableBoundary={showBoundaryEditor}
              heightClass="h-64 sm:h-72"
              onPointChange={(lat, lon) =>
                updateDraft({
                  latitude: lat,
                  longitude: lon,
                  location_confirmed: true,
                })
              }
              onBoundaryChange={(poly: GeoJsonPolygon | null, area) =>
                updateDraft({
                  boundary_geojson: poly,
                  area_hectares: area.hectares > 0 ? area.hectares : draft.area_hectares,
                  area_acres: area.acres > 0 ? area.acres : draft.area_acres,
                })
              }
            />

            <p className="text-xs text-black/60">
              Works anywhere on Earth covered by NASA POWER & GIBS satellites. Tap or drag the gold pin to adjust your exact plot.
            </p>
          </div>

          {/* Community / Country / Farm Name */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-black/70 mb-1">
                {language === 'tw' ? 'W’afuw din' : farmNameLabelT}
              </label>
              <VoiceGuidedInput
                fieldKey="farm_name"
                value={draft.name}
                onValueChange={(val) => updateDraft({ name: val })}
                placeholder={draft.community ? `${draft.community} Farm` : 'e.g. Valley Plot'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/70 mb-1">
                {language === 'tw' ? 'Kuro anaa Mpɔtam' : communityLabelT}
              </label>
              <VoiceGuidedInput
                fieldKey="community"
                value={draft.community}
                onValueChange={(val) => updateDraft({ community: val })}
                placeholder="e.g. Nakuru, Ames, Ejura"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/70 mb-1">
                {language === 'tw' ? 'Ɔman' : countryLabelT}
              </label>
              <VoiceGuidedInput
                fieldKey="country"
                value={draft.country}
                onValueChange={(val) => updateDraft({ country: val })}
                placeholder="e.g. Kenya, India, Ghana, USA"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => updateDraft({ location_confirmed: true, step: 2 })}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[#1F5A2E] text-white font-semibold text-base hover:bg-[#194A25] cursor-pointer"
            >
              <span>{copy.continueBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Farm Size */}
      {draft.step === 2 && (
        <div className="bg-white rounded-3xl border border-black/10 p-6 sm:p-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">{copy.howBig}</h2>
            <div className="inline-flex p-1 rounded-xl bg-[#F6EFE0] border border-black/10">
              <button
                type="button"
                onClick={() => setSizeUnit('acres')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  sizeUnit === 'acres' ? 'bg-[#1F5A2E] text-white' : 'text-black/70'
                }`}
              >
                Acres
              </button>
              <button
                type="button"
                onClick={() => setSizeUnit('hectares')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  sizeUnit === 'hectares' ? 'bg-[#1F5A2E] text-white' : 'text-black/70'
                }`}
              >
                Hectares
              </button>
            </div>
          </div>

          {draft.boundary_geojson && draft.area_acres && (
            <div className="p-4 rounded-2xl bg-[#1F5A2E]/10 border border-[#1F5A2E]/25 text-sm text-[#1F5A2E] font-medium">
              Measured from your farm boundary: <strong>{draft.area_acres} acres ({draft.area_hectares} ha)</strong>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            {sizeOptions.map((opt) => {
              const selected = draft.size_category === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    updateDraft({
                      size_category: opt.id,
                      area_acres: draft.boundary_geojson ? draft.area_acres : opt.acresVal,
                      area_hectares: draft.boundary_geojson ? draft.area_hectares : opt.haVal,
                      step: 3,
                    })
                  }
                  className={`flex flex-col items-center text-center gap-3 p-5 rounded-2xl border transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#1F5A2E] bg-[#1F5A2E]/10'
                      : 'border-black/15 bg-[#F6EFE0]/40 hover:bg-[#F6EFE0]'
                  }`}
                >
                  <FarmSizeIllustration tier={opt.tier} className="w-16 h-11" />
                  <div>
                    <div className="font-bold text-base text-[#1A1A1A]">
                      {language === 'tw' ? opt.tw : sizeUnit === 'acres' ? opt.acres : opt.hectares}
                    </div>
                    <div className="text-xs text-black/60 mt-0.5">
                      {sizeUnit === 'acres' ? opt.hectares : opt.acres}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => updateDraft({ step: 3 })}
              className="text-sm font-medium text-black/60 hover:text-[#1A1A1A] min-h-[44px] px-2 cursor-pointer"
            >
              {copy.skipStep}
            </button>
            <button
              type="button"
              onClick={() => updateDraft({ step: 3 })}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[#1F5A2E] text-white font-semibold cursor-pointer"
            >
              <span>{copy.continueBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Previous Crop */}
      {draft.step === 3 && (
        <div className="bg-white rounded-3xl border border-black/10 p-6 sm:p-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">{copy.lastSeason}</h2>
            <button
              type="button"
              onClick={handleVoiceCropCapture}
              className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                listeningCrop
                  ? 'bg-[#A2461F] text-white'
                  : 'bg-[#E3A72F]/20 text-[#1A1A1A] hover:bg-[#E3A72F]/35'
              }`}
            >
              {listeningCrop ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{listeningCrop ? copy.voiceGuideListening : language === 'tw' ? 'Ka w’ano' : sayCropLabelT}</span>
            </button>
          </div>

          {voiceNote && (
            <div className="p-3 rounded-xl bg-[#F6EFE0] border border-black/10 text-sm text-[#1A1A1A]">
              {voiceNote}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PREVIOUS_CROPS.map((cropId) => {
              const selected = draft.previous_crop === cropId;
              return (
                <button
                  key={cropId}
                  type="button"
                  onClick={() => updateDraft({ previous_crop: cropId, step: 4 })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#1F5A2E] bg-[#1F5A2E]/10'
                      : 'border-black/10 bg-[#F6EFE0]/35 hover:bg-[#F6EFE0]'
                  }`}
                >
                  <CropIllustration crop={cropId} className="w-12 h-12" />
                  <span className="font-semibold text-sm text-[#1A1A1A]">
                    {CROP_LABELS[cropId][language]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => updateDraft({ step: 4 })}
              className="text-sm font-medium text-black/60 hover:text-[#1A1A1A] min-h-[44px] px-2 cursor-pointer"
            >
              {copy.skipStep}
            </button>
            <button
              type="button"
              onClick={() => updateDraft({ step: 4 })}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[#1F5A2E] text-white font-semibold cursor-pointer"
            >
              <span>{copy.continueBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Intended Crop */}
      {draft.step === 4 && (
        <div className="bg-white rounded-3xl border border-black/10 p-6 sm:p-10 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">{copy.growNext}</h2>

          <button
            type="button"
            onClick={() => updateDraft({ intended_crop: 'help_me_decide', step: 5 })}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
              draft.intended_crop === 'help_me_decide'
                ? 'border-[#1F5A2E] bg-[#1F5A2E]/10'
                : 'border-[#E3A72F]/60 bg-[#E3A72F]/15 hover:bg-[#E3A72F]/25'
            }`}
          >
            <CropIllustration crop="help_me_decide" className="w-12 h-12 shrink-0" />
            <div>
              <div className="font-bold text-base text-[#1A1A1A]">
                {CROP_LABELS.help_me_decide[language]}
              </div>
              <div className="text-xs text-black/70">
                {language === 'tw'
                  ? 'Ma Farmova nhwɛ nsuo ne w’afifideɛ a etwaam so nkyerɛ wo'
                  : 'Let Farmova suggest a crop rotation based on your last crop and local NASA conditions'}
              </div>
            </div>
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PREVIOUS_CROPS.map((cropId) => {
              const selected = draft.intended_crop === cropId;
              return (
                <button
                  key={cropId}
                  type="button"
                  onClick={() => updateDraft({ intended_crop: cropId, step: 5 })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#1F5A2E] bg-[#1F5A2E]/10'
                      : 'border-black/10 bg-[#F6EFE0]/35 hover:bg-[#F6EFE0]'
                  }`}
                >
                  <CropIllustration crop={cropId} className="w-11 h-11" />
                  <span className="font-semibold text-sm text-[#1A1A1A]">
                    {CROP_LABELS[cropId][language]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => updateDraft({ intended_crop: 'help_me_decide', step: 5 })}
              className="text-sm font-medium text-black/60 hover:text-[#1A1A1A] min-h-[44px] px-2 cursor-pointer"
            >
              {copy.skipStep}
            </button>
            <button
              type="button"
              onClick={() => updateDraft({ step: 5 })}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[#1F5A2E] text-white font-semibold cursor-pointer"
            >
              <span>{copy.continueBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Priorities */}
      {draft.step === 5 && (
        <div className="bg-white rounded-3xl border border-black/10 p-6 sm:p-10 space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">{copy.whatMatters}</h2>
            <p className="text-sm text-black/65">
              {language === 'tw' ? 'Yi nea ɛho hia wo (wobɛtumi ayi pii)' : pickPrioritiesT}
            </p>
          </div>

          <div className="space-y-2.5">
            {PRIORITIES.map((pid) => {
              const active = draft.priorities.includes(pid);
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? draft.priorities.filter((p) => p !== pid)
                      : [...draft.priorities, pid];
                    updateDraft({ priorities: next });
                  }}
                  className={`w-full flex items-center justify-between min-h-[52px] px-5 py-3 rounded-2xl border text-left font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'border-[#1F5A2E] bg-[#1F5A2E]/10 text-[#1F5A2E]'
                      : 'border-black/15 bg-[#F6EFE0]/35 text-[#1A1A1A] hover:bg-[#F6EFE0]'
                  }`}
                >
                  <span>{PRIORITY_LABELS[pid][language]}</span>
                  {active && <Check className="w-5 h-5 text-[#1F5A2E]" />}
                </button>
              );
            })}
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-[#A2461F]/10 border border-[#A2461F]/30 text-sm text-[#A2461F]">
              {submitError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="text-sm font-medium text-black/60 hover:text-[#1A1A1A] min-h-[44px] px-2 cursor-pointer"
            >
              {copy.skipStep}
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="inline-flex items-center gap-2 min-h-[52px] px-7 py-3 rounded-xl bg-[#1F5A2E] text-white font-semibold text-base hover:bg-[#194A25] disabled:opacity-60 cursor-pointer"
            >
              <span>
                {submitting
                  ? language === 'tw'
                    ? 'Ɛrekɔfa NASA nsɛm aba...'
                    : retrievingNasaT
                  : language === 'tw'
                  ? 'Hwɛ M’afuw Ho Afotu'
                  : seeAdviceLabelT}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
