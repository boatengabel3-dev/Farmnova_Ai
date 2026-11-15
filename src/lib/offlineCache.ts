import { useEffect, useState } from 'react';
import type {
  ClimateBaselineMonth,
  CropId,
  CropRotationPlan,
  FarmIndicators,
  FarmRecord,
  GeoJsonPolygon,
  LandsatPrecisionScene,
  MeteomaticsWeatherPayload,
  PriorityId,
  ProgressLogRecord,
  RecommendationRecord,
  SeasonCycleRecord,
  SoilMoistureOutlook,
} from '../types';

const FARMER_ID_KEY = 'farmova_farmer_id';
const FARMS_CACHE_KEY = 'farmova_cached_farms_v1';
const INTEL_CACHE_PREFIX = 'farmova_intel_v1_';
const ONBOARDING_DRAFT_KEY = 'farmova_onboarding_draft_v2';
const SYNC_QUEUE_KEY = 'farmova_sync_queue_v1';

export interface OnboardingDraft {
  step: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_m: number | null;
  gps_recorded_at: string | null;
  is_at_farm: boolean | null;
  location_source: 'gps' | 'manual' | 'search';
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
}

export interface CachedIntelligencePayload {
  farm: FarmRecord;
  indicators: FarmIndicators | null;
  recommendation: RecommendationRecord | null;
  outlook?: SoilMoistureOutlook | null;
  rotationPlan?: CropRotationPlan | null;
  climatology?: ClimateBaselineMonth[];
  seasons?: SeasonCycleRecord[];
  progressLogs?: ProgressLogRecord[];
  meteomatics?: MeteomaticsWeatherPayload | null;
  landsatScenes?: LandsatPrecisionScene[];
  cachedAt: string;
}

export interface QueuedSyncItem {
  id: string;
  type: 'create_farm' | 'update_farm';
  payload: Record<string, unknown>;
  createdAt: string;
}

export function getOrCreateFarmerId(): string {
  try {
    let id = localStorage.getItem(FARMER_ID_KEY);
    if (!id) {
      id = `farmer-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(FARMER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'farmer-local';
  }
}

export function saveCachedFarms(farms: FarmRecord[]): void {
  try {
    localStorage.setItem(FARMS_CACHE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), farms }));
  } catch {
    // ignore storage quota errors
  }
}

export function loadCachedFarms(): { updatedAt: string | null; farms: FarmRecord[] } {
  try {
    const raw = localStorage.getItem(FARMS_CACHE_KEY);
    if (!raw) return { updatedAt: null, farms: [] };
    return JSON.parse(raw);
  } catch {
    return { updatedAt: null, farms: [] };
  }
}

export function saveCachedIntelligence(farmId: string, data: CachedIntelligencePayload): void {
  try {
    localStorage.setItem(INTEL_CACHE_PREFIX + farmId, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadCachedIntelligence(farmId: string): CachedIntelligencePayload | null {
  try {
    const raw = localStorage.getItem(INTEL_CACHE_PREFIX + farmId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function loadOnboardingDraft(): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearOnboardingDraft(): void {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function enqueueOfflineSync(item: Omit<QueuedSyncItem, 'id' | 'createdAt'>): QueuedSyncItem[] {
  const queue = getOfflineSyncQueue();
  const next: QueuedSyncItem[] = [
    ...queue,
    { ...item, id: `q-${Date.now()}`, createdAt: new Date().toISOString() },
  ];
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function getOfflineSyncQueue(): QueuedSyncItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setOfflineSyncQueue(queue: QueuedSyncItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return isOnline;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBefore = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBefore);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBefore);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable: Boolean(deferredPrompt), isInstalled, isIOS, install };
}
