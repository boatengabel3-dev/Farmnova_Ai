import { getOrCreateFarmerId, getOfflineSyncQueue, setOfflineSyncQueue } from './offlineCache';
import type {
  ClimateBaselineMonth,
  CropRotationPlan,
  DailyObservation,
  DatasetProvenance,
  DiscoveryResult,
  FarmIndicators,
  FarmRecord,
  GibsLayerSpec,
  GlobalLocationEntry,
  IngestionRunRecord,
  IntegrationStatusSummary,
  LandsatPrecisionScene,
  LanguageCapabilities,
  LanguageCode,
  MeteomaticsWeatherPayload,
  ProgressLogRecord,
  RecommendationRecord,
  SeasonCycleRecord,
  SoilMoistureOutlook,
  SupabaseEdgeSyncResult,
} from '../types';

async function apiFetch<T>(url: string, init?: RequestInit & { expertScope?: boolean }): Promise<T> {
  const farmerId = init?.expertScope ? 'expert-workspace' : getOrCreateFarmerId();
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-farmova-farmer-id': farmerId,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchLocations(q = ''): Promise<GlobalLocationEntry[]> {
  const data = await apiFetch<{ locations: GlobalLocationEntry[] }>(`/api/locations?q=${encodeURIComponent(q)}`);
  return data.locations;
}

export async function fetchGibsLayers(): Promise<GibsLayerSpec[]> {
  const data = await apiFetch<{ layers: GibsLayerSpec[] }>('/api/gibs-layers');
  return data.layers;
}

export async function fetchDatasets(): Promise<DatasetProvenance[]> {
  const data = await apiFetch<{ datasets: DatasetProvenance[] }>('/api/datasets');
  return data.datasets;
}

export async function fetchLanguageCapabilities(): Promise<LanguageCapabilities> {
  return apiFetch<LanguageCapabilities>('/api/language/capabilities');
}

export async function fetchFarms(scope: 'farmer' | 'all' = 'farmer'): Promise<FarmRecord[]> {
  const data = await apiFetch<{ farms: FarmRecord[] }>(`/api/farms?scope=${scope}`, {
    expertScope: scope === 'all',
  });
  return data.farms;
}

export async function createFarm(payload: Record<string, unknown>): Promise<{
  farm: FarmRecord;
  indicators: FarmIndicators;
  recommendation: RecommendationRecord;
  outlook?: SoilMoistureOutlook;
  rotationPlan?: CropRotationPlan;
  climatology?: ClimateBaselineMonth[];
  meteomatics?: MeteomaticsWeatherPayload;
  landsatScenes?: LandsatPrecisionScene[];
}> {
  return apiFetch('/api/farms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFarm(
  farmId: string,
  payload: Record<string, unknown>
): Promise<{
  farm: FarmRecord;
  indicators: FarmIndicators;
  recommendation: RecommendationRecord;
  outlook?: SoilMoistureOutlook;
}> {
  return apiFetch(`/api/farms/${farmId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchFarmIntelligence(
  farmId: string,
  expertScope = false
): Promise<{
  farm: FarmRecord;
  indicators: FarmIndicators;
  recommendation: RecommendationRecord;
  observations: DailyObservation[];
  climatology: ClimateBaselineMonth[];
  outlook: SoilMoistureOutlook;
  rotationPlan?: CropRotationPlan;
  cropHistory: Array<{ id: string; season_label: string; crop_id: string; notes: string; recorded_at: string }>;
  ingestionRuns: IngestionRunRecord[];
  seasons: SeasonCycleRecord[];
  progressLogs: ProgressLogRecord[];
  meteomatics: MeteomaticsWeatherPayload;
  landsatScenes: LandsatPrecisionScene[];
  integrations: IntegrationStatusSummary;
}> {
  return apiFetch(`/api/farms/${farmId}/intelligence`, { expertScope });
}

export async function syncNasaForFarm(
  farmId: string,
  expertScope = false
): Promise<{
  nasaSync: { success: boolean; recordsCount: number; elevationM: number | null; error?: string };
  discovery: DiscoveryResult;
  landsatScenes: LandsatPrecisionScene[];
  meteomatics: MeteomaticsWeatherPayload;
  integrations: IntegrationStatusSummary;
  indicators: FarmIndicators;
  recommendation: RecommendationRecord;
  observations: DailyObservation[];
  climatology: ClimateBaselineMonth[];
  outlook: SoilMoistureOutlook;
  rotationPlan?: CropRotationPlan;
  ingestionRuns: IngestionRunRecord[];
  seasons: SeasonCycleRecord[];
  datasets: DatasetProvenance[];
}> {
  return apiFetch(`/api/farms/${farmId}/sync-nasa`, {
    method: 'POST',
    expertScope,
  });
}

export async function syncMeteomatics(
  farmId: string,
  expertScope = false
): Promise<{
  meteomatics: MeteomaticsWeatherPayload;
  datasets: DatasetProvenance[];
  ingestionRuns: IngestionRunRecord[];
  integrations: IntegrationStatusSummary;
}> {
  return apiFetch(`/api/farms/${farmId}/sync-meteomatics`, {
    method: 'POST',
    expertScope,
  });
}

export async function invokeEdgeSync(
  farmId: string,
  expertScope = false
): Promise<{
  edgeSync: SupabaseEdgeSyncResult;
  meteomatics: MeteomaticsWeatherPayload;
  datasets: DatasetProvenance[];
  ingestionRuns: IngestionRunRecord[];
  integrations: IntegrationStatusSummary;
}> {
  return apiFetch(`/api/farms/${farmId}/edge-sync`, {
    method: 'POST',
    expertScope,
  });
}

export async function generateRecommendation(
  farmId: string,
  overrides: Record<string, unknown>
): Promise<{
  recommendation: RecommendationRecord;
  indicators: FarmIndicators;
  outlook?: SoilMoistureOutlook;
  rotationPlan?: CropRotationPlan;
}> {
  return apiFetch(`/api/farms/${farmId}/recommend`, {
    method: 'POST',
    body: JSON.stringify(overrides),
  });
}

export async function computeRotationPlan(
  farmId: string,
  overrides: Record<string, unknown>
): Promise<{
  rotationPlan: CropRotationPlan;
  recommendation: RecommendationRecord;
  outlook: SoilMoistureOutlook;
  indicators: FarmIndicators;
}> {
  return apiFetch(`/api/farms/${farmId}/rotation-plan`, {
    method: 'POST',
    body: JSON.stringify(overrides),
  });
}

export async function createOrUpdateSeason(
  farmId: string,
  payload: Record<string, unknown>
): Promise<{ seasons: SeasonCycleRecord[] }> {
  return apiFetch(`/api/farms/${farmId}/seasons`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addProgressLog(
  farmId: string,
  payload: Record<string, unknown>
): Promise<{ progressLogs: ProgressLogRecord[]; seasons: SeasonCycleRecord[] }> {
  return apiFetch(`/api/farms/${farmId}/progress`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function askAlpha(params: {
  question: string;
  language: LanguageCode;
  farmId?: string | null;
}): Promise<{ reply: string; language: LanguageCode; groundedInLiveNasa: boolean; provider: string }> {
  return apiFetch('/api/alpha/ask', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function synthesizeSpeech(
  text: string,
  language: LanguageCode = 'en'
): Promise<{ audioBase64: string; mimeType: string; provider: string }> {
  return apiFetch('/api/alpha/speak', {
    method: 'POST',
    body: JSON.stringify({ text, language }),
  });
}

export async function transcribeAudio(params: {
  audioBase64: string;
  mimeType: string;
  language: LanguageCode;
}): Promise<{ transcript: string; provider: string }> {
  return apiFetch('/api/alpha/transcribe', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function translateBatch(
  texts: string[],
  targetLanguage: LanguageCode
): Promise<{ translations: string[]; provider: string }> {
  return apiFetch('/api/translate/batch', {
    method: 'POST',
    body: JSON.stringify({ texts, targetLanguage }),
  });
}

export async function flushOfflineSyncQueue(): Promise<number> {
  const queue = getOfflineSyncQueue();
  if (queue.length === 0) return 0;
  const remaining = [];
  let synced = 0;
  for (const item of queue) {
    try {
      if (item.type === 'create_farm') {
        await createFarm(item.payload);
        synced++;
      } else if (item.type === 'update_farm' && typeof item.payload.id === 'string') {
        await updateFarm(item.payload.id, item.payload);
        synced++;
      }
    } catch {
      remaining.push(item);
    }
  }
  setOfflineSyncQueue(remaining);
  return synced;
}
