import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  FarmIndicators,
  FarmRecord,
  LanguageCode,
  RecommendationRecord,
  SeasonCycleRecord,
  SoilMoistureOutlook,
} from './types.ts';

export interface LanguageCapabilities {
  khayaConfigured: boolean;
  khayaTranslationAvailable: boolean;
  khayaAsrAvailable: boolean;
  khayaTtsAvailable: boolean;
  geminiAlphaAvailable: boolean;
  geminiTtsFallbackAvailable: boolean;
  supportedLanguages: Array<{
    code: LanguageCode;
    label: string;
    nativeLabel: string;
    speechLang: string;
  }>;
  notes: string;
}

export const GLOBAL_LANGUAGE_LIST: Array<{
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  speechLang: string;
}> = [
  { code: 'en', label: 'English', nativeLabel: 'English', speechLang: 'en-US' },
  { code: 'tw', label: 'Twi (Asante)', nativeLabel: 'Twi', speechLang: 'en-GH' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', speechLang: 'fr-FR' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', speechLang: 'es-ES' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', speechLang: 'pt-BR' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili', speechLang: 'sw-KE' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', speechLang: 'hi-IN' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', speechLang: 'ar-SA' },
];

export function normalizeLanguageCode(raw: unknown): LanguageCode {
  const s = String(raw ?? '').toLowerCase();
  const found = GLOBAL_LANGUAGE_LIST.find((l) => l.code === s);
  return found ? found.code : 'en';
}

export function getLanguageCapabilities(): LanguageCapabilities {
  const hasKhaya = Boolean(process.env.GHANANLP_API_KEY && process.env.GHANANLP_API_KEY.trim().length > 0);
  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim().length > 0 &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  return {
    khayaConfigured: hasKhaya,
    khayaTranslationAvailable: hasKhaya,
    khayaAsrAvailable: hasKhaya,
    khayaTtsAvailable: hasKhaya,
    geminiAlphaAvailable: hasGemini,
    geminiTtsFallbackAvailable: hasGemini,
    supportedLanguages: GLOBAL_LANGUAGE_LIST,
    notes: hasKhaya
      ? 'Khaya AI / GhanaNLP + Gemini global multilingual voice & translation active (EN, Twi, FR, ES, PT, SW, HI, AR).'
      : 'Global multilingual AI guide, voice input coaching, and TTS active across 8 languages (EN, Twi, FR, ES, PT, SW, HI, AR).',
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function translateWithKhaya(
  text: string,
  langPair: 'en-tw' | 'tw-en'
): Promise<{ translatedText: string; provider: 'khaya' | 'fallback' }> {
  const apiKey = process.env.GHANANLP_API_KEY;
  if (!apiKey) {
    return { translatedText: text, provider: 'fallback' };
  }

  try {
    const res = await fetch('https://translation-api.ghananlp.org/v1/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      body: JSON.stringify({
        in: text,
        lang: langPair,
      }),
    });
    if (!res.ok) {
      return { translatedText: text, provider: 'fallback' };
    }
    const data = await res.json();
    const out = typeof data === 'string' ? data : data?.out ?? data?.translation ?? text;
    return { translatedText: String(out), provider: 'khaya' };
  } catch {
    return { translatedText: text, provider: 'fallback' };
  }
}

const serverTranslationCache = new Map<string, string[]>();

export async function translateTextsBatch(
  texts: string[],
  targetLanguage: LanguageCode
): Promise<{ translations: string[]; provider: string }> {
  if (targetLanguage === 'en' || texts.length === 0) {
    return { translations: texts, provider: 'native' };
  }

  const cacheKey = `${targetLanguage}::${JSON.stringify(texts)}`;
  const cached = serverTranslationCache.get(cacheKey);
  if (cached) {
    return { translations: cached, provider: 'Farmova Cache' };
  }

  // Use Khaya first if translating to Twi and key exists
  if (targetLanguage === 'tw' && process.env.GHANANLP_API_KEY) {
    const out = await Promise.all(
      texts.map(async (t) => {
        if (!t.trim()) return t;
        const res = await translateWithKhaya(t, 'en-tw');
        return res.translatedText;
      })
    );
    serverTranslationCache.set(cacheKey, out);
    return { translations: out, provider: 'Khaya AI' };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return { translations: texts, provider: 'fallback' };
  }

  const langMeta = GLOBAL_LANGUAGE_LIST.find((l) => l.code === targetLanguage)!;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        `Translate each agricultural advisory string in the input array into natural, clear, farmer-friendly ${langMeta.label} (${langMeta.nativeLabel}).`,
        'Preserve all numbers, measurements (mm, °C, %, km, dates), crop names, and NASA / Meteomatics attributions accurately.',
        'Return an array of translated strings with the EXACT same length and order as the input.',
        JSON.stringify(texts),
      ].join('\n\n'),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '[]').trim());
    if (Array.isArray(parsed) && parsed.length === texts.length) {
      const cleaned = parsed.map((v) => String(v));
      serverTranslationCache.set(cacheKey, cleaned);
      return { translations: cleaned, provider: 'Gemini Multilingual' };
    }
    return { translations: texts, provider: 'fallback' };
  } catch (err) {
    console.error('Batch translation error:', err instanceof Error ? err.message : err);
    return { translations: texts, provider: 'fallback' };
  }
}

export async function askAlphaAssistant(params: {
  question: string;
  language: LanguageCode;
  farm: FarmRecord | null;
  indicators: FarmIndicators | null;
  recommendation: RecommendationRecord | null;
  outlook?: SoilMoistureOutlook | null;
  activeSeason?: SeasonCycleRecord | null;
}): Promise<{ reply: string; language: LanguageCode; groundedInLiveNasa: boolean; provider: string }> {
  const { question, language, farm, indicators, recommendation, outlook, activeSeason } = params;
  const ai = getGeminiClient();
  const langMeta = GLOBAL_LANGUAGE_LIST.find((l) => l.code === language) ?? GLOBAL_LANGUAGE_LIST[0];
  const isLive = indicators?.data_source_mode === 'live_nasa_power';

  const deterministicReply = (): string => {
    if (!farm) {
      const noFarmMap: Record<LanguageCode, string> = {
        en: "Welcome! I'm Alpha, your Farmova farming guide. Let's first locate your farm on the map so I can explain your local NASA conditions, moisture outlook, and crop rotation options.",
        tw: 'Akwaaba! Me din de Alpha. Di kan kyerɛ baabi a w’afuw wɔ wɔ asase mfonini no so na mɛtumi aboa wo ama woate NASA nsɛm ne aduane a ɛsɛ sɛ wudua no ase.',
        fr: "Bienvenue ! Je suis Alpha, votre guide agricole Farmova. Localisons d'abord votre parcelle sur la carte afin d'analyser vos données NASA et la rotation des cultures.",
        es: '¡Bienvenido! Soy Alpha, tu guía agrícola Farmova. Primero ubiquemos tu finca en el mapa para explicar las condiciones NASA, la humedad del suelo y qué cultivar después.',
        pt: 'Bem-vindo! Sou Alpha, seu guia agrícola Farmova. Primeiro vamos localizar sua fazenda no mapa para explicar os dados da NASA e a rotação de culturas.',
        sw: 'Karibu! Mimi ni Alpha, mshauri wako wa kilimo wa Farmova. Kwanza tuweke alama ya shamba lako kwenye ramani ili tueleze hali ya NASA na mpango wa mzunguko wa mazao.',
        hi: 'स्वागत है! मैं अल्फा हूँ, आपका फार्मॉवा कृषि मार्गदर्शक। पहले मानचित्र पर अपना खेत चुनें ताकि मैं नासा मौसम, मिट्टी की नमी और फसल चक्र की जानकारी दे सकूँ।',
        ar: 'مرحبًا! أنا ألفا، مرشدك الزراعي في فارموفا. لنحدد موقع مزرعتك على الخريطة أولاً لنشرح لك بيانات ناسا ورطوبة التربة وخطة الدورة الزراعية.',
      };
      return noFarmMap[language];
    }

    const qLower = question.toLowerCase();
    if (/moisture|wet|soil|nkɔmhyɛ|fɔ|humid|humedad|umidade|unye|नमी|رطوبة|7|14/.test(qLower) && outlook) {
      const nowPct = outlook.current_root_wetness !== null ? `${Math.round(outlook.current_root_wetness * 100)}%` : 'N/A';
      const p7 = outlook.projected_7d_wetness !== null ? `${Math.round(outlook.projected_7d_wetness * 100)}%` : 'N/A';
      const p14 = outlook.projected_14d_wetness !== null ? `${Math.round(outlook.projected_14d_wetness * 100)}%` : 'N/A';
      if (language === 'tw') {
        return `NASA asase mu fɔ (GWETROOT) wɔ ${farm.name} seesei yɛ ${nowPct}. Nna 7 nkɔmhyɛ yɛ ${p7} na nna 14 nkɔmhyɛ yɛ ${p14} (${outlook.trend_direction}).`;
      }
      return `For ${farm.name}, NASA POWER currently estimates root-zone wetness at ${nowPct}. Based on your recent water balance (${outlook.net_water_balance_mm_day ?? 0} mm/day) and 20-year climate normal, it projects ${p7} in 7 days and ${p14} in 14 days (${outlook.trend_direction} trend).`;
    }
    if (/disaster|risk|flood|drought|hazard|eonet|heat|asiane|kɔkɔbɔ|risque|riesgo|hatari|आफत|خطر/.test(qLower) && outlook) {
      const alerts = outlook.disaster_risks.map((r) => `${r.type}: ${r.level}`).join('; ');
      return language === 'tw'
        ? `NASA kɔkɔbɔ ma ${farm.name}: ${outlook.disaster_risks.map((r) => `${r.type} (${r.level}) — ${r.summary_tw}`).join(' ')}`
        : `Here is your NASA disaster risk scan for ${farm.name}: ${alerts}. ${outlook.nearby_eonet_events[0] ? `Nearest NASA EONET event is "${outlook.nearby_eonet_events[0].title}" (${outlook.nearby_eonet_events[0].distance_km} km away).` : 'No active NASA EONET natural hazards are within 600 km.'}`;
    }
    if (/season|progress|plant|stage|afe|nkɔsoɔ/.test(qLower) && activeSeason) {
      return language === 'tw'
        ? `W’afuw afe yi mu adwuma (${activeSeason.season_name}) adu "${activeSeason.stage}". Efi da a wuduae (${activeSeason.planted_date}) no, NASA akyerɛ nsuo ${activeSeason.nasa_rain_since_planting_mm ?? 'N/A'} mm.`
        : `Your active season "${activeSeason.season_name}" (planted ${activeSeason.planted_date}) is currently at the ${activeSeason.stage} stage. NASA POWER has recorded ${activeSeason.nasa_rain_since_planting_mm ?? 'N/A'} mm of cumulative rainfall since planting.`;
    }
    if (recommendation) {
      return language === 'tw'
        ? `${recommendation.headline_tw}. ${recommendation.reason_tw}`
        : `${recommendation.headline_en}. ${recommendation.reason_en}`;
    }
    return language === 'tw'
      ? `W’afuw (${farm.name}) no tebea seesei yɛ: ${indicators?.health_category ?? 'Yɛrehwehwɛ mu'}.`
      : `Your farm (${farm.name}) currently shows: ${indicators?.health_category ?? 'Not enough information yet'}.`;
  };

  if (!ai) {
    return {
      reply: deterministicReply(),
      language,
      groundedInLiveNasa: isLive,
      provider: 'Farmova Grounded Rules',
    };
  }

  const verifiedContext = {
    farm: farm
      ? {
          name: farm.name,
          community: farm.community,
          district: farm.district,
          region: farm.region,
          country: farm.country,
          area_acres: farm.area_acres,
          area_hectares: farm.area_hectares,
          previous_crop: farm.previous_crop,
          intended_crop: farm.intended_crop,
          priorities: farm.priorities,
          is_demo: farm.is_demo,
        }
      : null,
    verified_indicators: indicators
      ? {
          health_category: indicators.health_category,
          data_source_mode: indicators.data_source_mode,
          observation_period: `${indicators.observation_start ?? 'N/A'} to ${indicators.observation_end ?? 'N/A'}`,
          rainfall_30d_mm: indicators.rainfall_30d_mm,
          rainfall_anomaly_pct: indicators.rainfall_anomaly_pct,
          dry_spell_days: indicators.dry_spell_days,
          mean_temp_c: indicators.mean_temp_c,
          max_temp_c: indicators.max_temp_c,
          surface_wetness_index: indicators.surface_wetness_index,
          root_wetness_index: indicators.root_wetness_index,
          elevation_m: indicators.elevation_m,
        }
      : null,
    verified_outlook_and_risks: outlook
      ? {
          projected_7d_wetness: outlook.projected_7d_wetness,
          projected_14d_wetness: outlook.projected_14d_wetness,
          trend_direction: outlook.trend_direction,
          climate_rainfall_vs_normal_pct: outlook.climate_rainfall_vs_normal_pct,
          climate_temp_vs_normal_c: outlook.climate_temp_vs_normal_c,
          disaster_risks: outlook.disaster_risks.map((r) => ({ type: r.type, level: r.level, summary: r.summary_en })),
          nearby_eonet_events: outlook.nearby_eonet_events.slice(0, 3),
        }
      : null,
    active_season_progress: activeSeason ?? null,
    verified_recommendation: recommendation
      ? {
          suggested_crop: recommendation.suggested_crop,
          headline_en: recommendation.headline_en,
          reason_en: recommendation.reason_en,
          next_actions_en: recommendation.next_actions_en,
          evidence_quality: recommendation.evidence_quality,
        }
      : null,
  };

  const systemInstruction = [
    'You are Alpha, the warm, respectful farming guide inside Farmova AI for smallholder and family farmers worldwide.',
    'STRICT GROUNDING RULES:',
    '1. ONLY state environmental numbers, soil moisture projections, climate anomalies, hazard alerts, or crop recommendations present in VERIFIED_FARMOVA_DATA.',
    '2. NEVER invent NASA satellite measurements, never fabricate yields, and never prescribe chemical fertilizers or pesticides.',
    '3. Keep answers concise (3–5 clear sentences), warm, practical, and easy to understand.',
    '4. If data_source_mode is "demonstration_cache", mention clearly that these are demonstration baseline figures until live NASA observations are refreshed.',
    '5. When discussing 7–14 day soil wetness or disaster risks, explain clearly that they are trends derived from NASA POWER observations, 20-year climatology, and NASA EONET hazard tracking.',
    `6. ALWAYS respond exclusively in natural, respectful ${langMeta.label} (${langMeta.nativeLabel}).`,
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `VERIFIED_FARMOVA_DATA:\n${JSON.stringify(verifiedContext, null, 2)}\n\nFARMER_QUESTION (${langMeta.label}): ${question}`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const text = (response.text ?? '').trim();
    if (!text) {
      return { reply: deterministicReply(), language, groundedInLiveNasa: isLive, provider: 'Farmova Grounded Rules' };
    }
    return {
      reply: text,
      language,
      groundedInLiveNasa: isLive,
      provider: `Alpha (Gemini · ${langMeta.nativeLabel})`,
    };
  } catch (err) {
    console.error('Alpha Gemini error:', err instanceof Error ? err.message : err);
    return {
      reply: deterministicReply(),
      language,
      groundedInLiveNasa: isLive,
      provider: 'Farmova Grounded Rules',
    };
  }
}

export async function synthesizeSpeechAudio(
  text: string,
  language: LanguageCode = 'en'
): Promise<{ audioBase64: string; mimeType: string; provider: string } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const langMeta = GLOBAL_LANGUAGE_LIST.find((l) => l.code === language) ?? GLOBAL_LANGUAGE_LIST[0];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: `Warm, patient, encouraging agricultural guide speaking clearly and naturally in ${langMeta.label} (${langMeta.speechLang})`,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;
    return { audioBase64: base64Audio, mimeType: 'audio/wav', provider: 'gemini-3.8-flash-lite-tts' };
  } catch (err) {
    console.error('TTS synthesis error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function transcribeFarmerAudio(
  base64Audio: string,
  mimeType: string,
  language: LanguageCode
): Promise<{ transcript: string; provider: string } | null> {
  const khayaKey = process.env.GHANANLP_API_KEY;
  if (khayaKey && language === 'tw') {
    try {
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const res = await fetch('https://translation-api.ghananlp.org/asr/v1/transcribe?language=tw', {
        method: 'POST',
        headers: {
          'Content-Type': mimeType || 'audio/wav',
          'Ocp-Apim-Subscription-Key': khayaKey,
        },
        body: audioBuffer,
      });
      if (res.ok) {
        const data = await res.json();
        const transcript = typeof data === 'string' ? data : data?.text ?? data?.transcript;
        if (transcript) return { transcript: String(transcript), provider: 'Khaya AI ASR' };
      }
    } catch {
      // fall through
    }
  }

  const ai = getGeminiClient();
  if (!ai) return null;

  const langMeta = GLOBAL_LANGUAGE_LIST.find((l) => l.code === language) ?? GLOBAL_LANGUAGE_LIST[0];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || 'audio/webm', data: base64Audio } },
          {
            text: `Transcribe this farmer's spoken audio accurately in ${langMeta.label} (${langMeta.nativeLabel}). Return only the spoken words.`,
          },
        ],
      },
    });
    const transcript = (response.text ?? '').trim();
    return transcript ? { transcript, provider: 'Gemini Audio Transcribe' } : null;
  } catch (err) {
    console.error('Audio transcription error:', err instanceof Error ? err.message : err);
    return null;
  }
}
