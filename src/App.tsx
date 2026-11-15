import { useCallback, useEffect, useState } from 'react';
import { Calendar, Compass, FlaskConical, Globe, MessageCircle, Sprout, WifiOff } from 'lucide-react';
import {
  fetchFarmIntelligence,
  fetchFarms,
  fetchGibsLayers,
  fetchLanguageCapabilities,
  flushOfflineSyncQueue,
} from './lib/api';
import { getLanguageMeta, SUPPORTED_LANGUAGES, UI_COPY } from './lib/i18n';
import {
  loadCachedFarms,
  loadCachedIntelligence,
  loadOnboardingDraft,
  saveCachedFarms,
  saveCachedIntelligence,
  useOnlineStatus,
} from './lib/offlineCache';
import type {
  ClimateBaselineMonth,
  CropRotationPlan,
  FarmIndicators,
  FarmRecord,
  GibsLayerSpec,
  LandsatPrecisionScene,
  LanguageCapabilities,
  LanguageCode,
  MeteomaticsWeatherPayload,
  ProgressLogRecord,
  RecommendationRecord,
  SeasonCycleRecord,
  SoilMoistureOutlook,
} from './types';
import { AlphaAssistant } from './components/AlphaAssistant';
import { CropRotationPage } from './components/CropRotationPage';
import { FarmerDashboard } from './components/FarmerDashboard';
import { FarmerOnboarding } from './components/FarmerOnboarding';
import { FarmovaLogo } from './components/FarmovaIllustrations';
import { PWAInstallButton } from './components/PWAInstallButton';
import { TechnicalWorkspace } from './components/TechnicalWorkspace';
import { VoiceGuideActiveBar, VoiceGuideProvider } from './components/VoiceGuidedField';

type WorkspaceMode = 'farmer' | 'rotation' | 'technical';

export default function App() {
  const isOnline = useOnlineStatus();
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [mode, setMode] = useState<WorkspaceMode>('farmer');
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string>('demo-ejura-farm');
  const [indicators, setIndicators] = useState<FarmIndicators | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationRecord | null>(null);
  const [outlook, setOutlook] = useState<SoilMoistureOutlook | null>(null);
  const [rotationPlan, setRotationPlan] = useState<CropRotationPlan | null>(null);
  const [climatology, setClimatology] = useState<ClimateBaselineMonth[]>([]);
  const [seasons, setSeasons] = useState<SeasonCycleRecord[]>([]);
  const [progressLogs, setProgressLogs] = useState<ProgressLogRecord[]>([]);
  const [meteomatics, setMeteomatics] = useState<MeteomaticsWeatherPayload | null>(null);
  const [landsatScenes, setLandsatScenes] = useState<LandsatPrecisionScene[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [gibsLayers, setGibsLayers] = useState<GibsLayerSpec[]>([]);
  const [langCapabilities, setLangCapabilities] = useState<LanguageCapabilities | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [alphaOpen, setAlphaOpen] = useState<boolean>(false);
  const [booting, setBooting] = useState<boolean>(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const copy = UI_COPY[language];
  const langMeta = getLanguageMeta(language);

  const loadFarmDetails = useCallback(
    async (farmId: string, fallbackFarm?: FarmRecord) => {
      if (!navigator.onLine) {
        const cached = loadCachedIntelligence(farmId);
        if (cached) {
          setIndicators(cached.indicators);
          setRecommendation(cached.recommendation);
          setOutlook(cached.outlook ?? null);
          setRotationPlan(cached.rotationPlan ?? null);
          setClimatology(cached.climatology ?? []);
          setSeasons(cached.seasons ?? []);
          setProgressLogs(cached.progressLogs ?? []);
          setMeteomatics(cached.meteomatics ?? null);
          setLandsatScenes(cached.landsatScenes ?? []);
          setCachedAt(cached.cachedAt);
        }
        return;
      }

      try {
        const intel = await fetchFarmIntelligence(farmId);
        setIndicators(intel.indicators);
        setRecommendation(intel.recommendation);
        setOutlook(intel.outlook ?? null);
        setRotationPlan(intel.rotationPlan ?? null);
        setClimatology(intel.climatology ?? []);
        setSeasons(intel.seasons ?? []);
        setProgressLogs(intel.progressLogs ?? []);
        setMeteomatics(intel.meteomatics ?? null);
        setLandsatScenes(intel.landsatScenes ?? []);
        const now = new Date().toISOString();
        setCachedAt(now);
        saveCachedIntelligence(farmId, {
          farm: intel.farm,
          indicators: intel.indicators,
          recommendation: intel.recommendation,
          outlook: intel.outlook,
          rotationPlan: intel.rotationPlan ?? null,
          climatology: intel.climatology,
          seasons: intel.seasons,
          progressLogs: intel.progressLogs,
          meteomatics: intel.meteomatics,
          landsatScenes: intel.landsatScenes,
          cachedAt: now,
        });
      } catch {
        const cached = loadCachedIntelligence(farmId);
        if (cached) {
          setIndicators(cached.indicators);
          setRecommendation(cached.recommendation);
          setOutlook(cached.outlook ?? null);
          setRotationPlan(cached.rotationPlan ?? null);
          setClimatology(cached.climatology ?? []);
          setSeasons(cached.seasons ?? []);
          setProgressLogs(cached.progressLogs ?? []);
          setMeteomatics(cached.meteomatics ?? null);
          setLandsatScenes(cached.landsatScenes ?? []);
          setCachedAt(cached.cachedAt);
        } else if (fallbackFarm) {
          setIndicators(fallbackFarm.indicators ?? null);
          setRecommendation(fallbackFarm.latestRecommendation ?? null);
        }
      }
    },
    []
  );

  // Initial boot: fetch farms, GIBS layers, and language capabilities (with offline fallback)
  useEffect(() => {
    const init = async () => {
      try {
        const [loadedFarms, layers, caps] = await Promise.all([
          fetchFarms('farmer'),
          fetchGibsLayers().catch(() => []),
          fetchLanguageCapabilities().catch(() => null),
        ]);
        setFarms(loadedFarms);
        saveCachedFarms(loadedFarms);
        setGibsLayers(layers);
        setLangCapabilities(caps);

        const personalFarm = loadedFarms.find((f) => !f.is_demo);
        const draft = loadOnboardingDraft();
        if (personalFarm) {
          setActiveFarmId(personalFarm.id);
          setShowOnboarding(false);
          await loadFarmDetails(personalFarm.id, personalFarm);
        } else if (draft && draft.step > 0) {
          setShowOnboarding(true);
          if (loadedFarms[0]) {
            setActiveFarmId(loadedFarms[0].id);
            await loadFarmDetails(loadedFarms[0].id, loadedFarms[0]);
          }
        } else {
          setShowOnboarding(true);
          if (loadedFarms[0]) {
            setActiveFarmId(loadedFarms[0].id);
            await loadFarmDetails(loadedFarms[0].id, loadedFarms[0]);
          }
        }
      } catch {
        const cached = loadCachedFarms();
        if (cached.farms.length > 0) {
          setFarms(cached.farms);
          const personal = cached.farms.find((f) => !f.is_demo) ?? cached.farms[0];
          setActiveFarmId(personal.id);
          setShowOnboarding(false);
          await loadFarmDetails(personal.id, personal);
        }
      } finally {
        setBooting(false);
      }
    };

    init();
  }, [loadFarmDetails]);

  // Flush queued offline farm registrations when connectivity returns
  useEffect(() => {
    if (!isOnline) return;
    flushOfflineSyncQueue()
      .then(async (count) => {
        if (count > 0) {
          setSyncNotice(`Synced ${count} offline farm update${count > 1 ? 's' : ''}.`);
          const updated = await fetchFarms('farmer');
          setFarms(updated);
          saveCachedFarms(updated);
          const newest = updated.find((f) => !f.is_demo);
          if (newest) {
            setActiveFarmId(newest.id);
            await loadFarmDetails(newest.id, newest);
          }
        }
      })
      .catch(() => undefined);
  }, [isOnline, loadFarmDetails]);

  const activeFarm = farms.find((f) => f.id === activeFarmId) ?? farms[0] ?? null;

  const handleSelectFarm = async (farmId: string) => {
    setActiveFarmId(farmId);
    setShowOnboarding(false);
    const target = farms.find((f) => f.id === farmId);
    await loadFarmDetails(farmId, target);
  };

  return (
    <VoiceGuideProvider language={language}>
      <div dir={langMeta.dir} className="min-h-screen flex flex-col bg-[#F6EFE0] text-[#1A1A1A]">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-black/10 px-4 sm:px-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setMode('farmer');
              setShowOnboarding(false);
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FarmovaLogo size={32} />
            <span className="font-display font-bold text-lg tracking-tight text-[#1A1A1A]">
              Farmova AI
            </span>
          </button>

          {/* Primary Navigation Links */}
          <div className="hidden sm:inline-flex p-0.5 rounded-xl bg-black/5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode('farmer');
                setShowOnboarding(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'farmer' ? 'bg-white text-[#1F5A2E] shadow-xs' : 'text-black/65 hover:text-[#1A1A1A]'
              }`}
            >
              <Sprout className="w-3.5 h-3.5" />
              <span>{copy.farmerView}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('rotation');
                setShowOnboarding(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'rotation' ? 'bg-white text-[#1F5A2E] shadow-xs' : 'text-black/65 hover:text-[#1A1A1A]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{copy.cropRotationNav}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('technical')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'technical' ? 'bg-white text-slate-900 shadow-xs' : 'text-black/65 hover:text-[#1A1A1A]'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>{copy.expertView}</span>
            </button>
          </div>

          {/* Language Selector & Install */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F6EFE0] border border-black/10 text-xs font-semibold text-[#1A1A1A]">
              <Globe className="w-3.5 h-3.5 text-[#1F5A2E] shrink-0" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                aria-label="Select application language"
                className="bg-transparent text-xs font-semibold text-[#1A1A1A] focus:outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.nativeLabel}
                  </option>
                ))}
              </select>
            </label>

            <PWAInstallButton />
          </div>
        </header>

        {/* Offline / Sync Status Banner */}
        {!isOnline && (
          <div className="bg-[#A2461F] text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>{copy.offlineNotice}</span>
          </div>
        )}
        {syncNotice && isOnline && (
          <div className="bg-[#1F5A2E] text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-3">
            <span>{syncNotice}</span>
            <button type="button" onClick={() => setSyncNotice(null)} className="underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1">
          {booting ? (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-black/65">
              Preparing Farmova AI...
            </div>
          ) : mode === 'technical' ? (
            <TechnicalWorkspace
              gibsLayers={gibsLayers}
              langCapabilities={langCapabilities}
              initialFarmId={activeFarm?.id}
            />
          ) : showOnboarding || !activeFarm ? (
            <FarmerOnboarding
              language={language}
              gibsLayers={gibsLayers}
              isOnline={isOnline}
              onCancel={farms.length > 0 ? () => setShowOnboarding(false) : undefined}
              onUseDemoFarm={
                farms.find((f) => f.is_demo)
                  ? () => {
                      const demo = farms.find((f) => f.is_demo)!;
                      handleSelectFarm(demo.id);
                    }
                  : undefined
              }
              onComplete={(res) => {
                setFarms((prev) => {
                  const next = [res.farm, ...prev.filter((f) => f.id !== res.farm.id)];
                  saveCachedFarms(next);
                  return next;
                });
                setActiveFarmId(res.farm.id);
                if (res.indicators) setIndicators(res.indicators);
                if (res.recommendation) setRecommendation(res.recommendation);
                if (res.outlook) setOutlook(res.outlook);
                if (res.rotationPlan) setRotationPlan(res.rotationPlan);
                if (res.climatology) setClimatology(res.climatology);
                if (res.meteomatics) setMeteomatics(res.meteomatics);
                if (res.landsatScenes) setLandsatScenes(res.landsatScenes);
                setSeasons([]);
                setProgressLogs([]);
                const now = new Date().toISOString();
                setCachedAt(now);
                saveCachedIntelligence(res.farm.id, {
                  farm: res.farm,
                  indicators: res.indicators ?? null,
                  recommendation: res.recommendation ?? null,
                  outlook: res.outlook ?? null,
                  rotationPlan: res.rotationPlan ?? null,
                  climatology: res.climatology ?? [],
                  seasons: [],
                  progressLogs: [],
                  meteomatics: res.meteomatics ?? null,
                  landsatScenes: res.landsatScenes ?? [],
                  cachedAt: now,
                });
                setShowOnboarding(false);
              }}
            />
          ) : mode === 'rotation' ? (
            <CropRotationPage
              language={language}
              activeFarm={activeFarm}
              rotationPlan={rotationPlan}
              indicators={indicators}
              outlook={outlook}
              isOnline={isOnline}
              onGoToGuide={() => setMode('farmer')}
              onPlanUpdated={(patch) => {
                if (patch.farm) {
                  setFarms((prev) => prev.map((f) => (f.id === patch.farm!.id ? patch.farm! : f)));
                }
                if (patch.rotationPlan) setRotationPlan(patch.rotationPlan);
                if (patch.recommendation) setRecommendation(patch.recommendation);
                if (patch.outlook) setOutlook(patch.outlook);
                if (patch.indicators) setIndicators(patch.indicators);
                if (patch.seasons) setSeasons(patch.seasons);
                const now = new Date().toISOString();
                setCachedAt(now);
                saveCachedIntelligence(activeFarm.id, {
                  farm: patch.farm ?? activeFarm,
                  indicators: patch.indicators ?? indicators,
                  recommendation: patch.recommendation ?? recommendation,
                  outlook: patch.outlook ?? outlook,
                  rotationPlan: patch.rotationPlan ?? rotationPlan,
                  climatology,
                  seasons: patch.seasons ?? seasons,
                  progressLogs,
                  meteomatics,
                  landsatScenes,
                  cachedAt: now,
                });
              }}
            />
          ) : (
            <FarmerDashboard
              language={language}
              farms={farms}
              activeFarm={activeFarm}
              indicators={indicators}
              recommendation={recommendation}
              outlook={outlook}
              climatology={climatology}
              seasons={seasons}
              progressLogs={progressLogs}
              meteomatics={meteomatics}
              landsatScenes={landsatScenes}
              gibsLayers={gibsLayers}
              isOnline={isOnline}
              cachedAt={cachedAt}
              onSelectFarm={handleSelectFarm}
              onAddNewFarm={() => setShowOnboarding(true)}
              onOpenAlpha={() => setAlphaOpen(true)}
              onOpenCropRotation={() => {
                setMode('rotation');
                setShowOnboarding(false);
              }}
              onDataUpdated={(patch) => {
                if (patch.farm) {
                  setFarms((prev) => prev.map((f) => (f.id === patch.farm!.id ? patch.farm! : f)));
                }
                if (patch.indicators) setIndicators(patch.indicators);
                if (patch.recommendation) setRecommendation(patch.recommendation);
                if (patch.outlook) setOutlook(patch.outlook);
                if (patch.rotationPlan) setRotationPlan(patch.rotationPlan);
                if (patch.climatology) setClimatology(patch.climatology);
                if (patch.seasons) setSeasons(patch.seasons);
                if (patch.progressLogs) setProgressLogs(patch.progressLogs);
                if (patch.meteomatics) setMeteomatics(patch.meteomatics);
                if (patch.landsatScenes) setLandsatScenes(patch.landsatScenes);
                const now = new Date().toISOString();
                setCachedAt(now);
                saveCachedIntelligence(activeFarm.id, {
                  farm: patch.farm ?? activeFarm,
                  indicators: patch.indicators ?? indicators,
                  recommendation: patch.recommendation ?? recommendation,
                  outlook: patch.outlook ?? outlook,
                  rotationPlan: patch.rotationPlan ?? rotationPlan,
                  climatology: patch.climatology ?? climatology,
                  seasons: patch.seasons ?? seasons,
                  progressLogs: patch.progressLogs ?? progressLogs,
                  meteomatics: patch.meteomatics ?? meteomatics,
                  landsatScenes: patch.landsatScenes ?? landsatScenes,
                  cachedAt: now,
                });
              }}
            />
          )}
        </main>

        {/* Mobile Bottom Thumb Navigation */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-black/10 grid grid-cols-4 items-center px-1">
          <button
            type="button"
            onClick={() => {
              setMode('farmer');
              setShowOnboarding(false);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
              mode === 'farmer' && !showOnboarding ? 'text-[#1F5A2E]' : 'text-black/55'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="truncate max-w-full px-1">{copy.farmerView}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('rotation');
              setShowOnboarding(false);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
              mode === 'rotation' && !showOnboarding ? 'text-[#1F5A2E]' : 'text-black/55'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="truncate max-w-full px-1">{copy.cropRotationNav}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAlphaOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-semibold text-[#1F5A2E] whitespace-nowrap cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="truncate max-w-full px-1">{copy.askAlpha}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('technical')}
            className={`flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
              mode === 'technical' ? 'text-slate-900' : 'text-black/55'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span>Expert</span>
          </button>
        </nav>

        {/* Floating Active Input Voice Coach Bar */}
        <VoiceGuideActiveBar />

        {/* Alpha Conversational Assistant */}
        <AlphaAssistant
          open={alphaOpen}
          onClose={() => setAlphaOpen(false)}
          language={language}
          onLanguageChange={setLanguage}
          farm={activeFarm}
          langCapabilities={langCapabilities}
        />
      </div>
    </VoiceGuideProvider>
  );
}

