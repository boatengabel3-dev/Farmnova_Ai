import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square, Volume2, X } from 'lucide-react';
import { transcribeAudio, translateBatch } from '../lib/api';
import { FIELD_VOICE_GUIDES, getLanguageMeta, UI_COPY, type FieldGuideKey } from '../lib/i18n';
import type { LanguageCode } from '../types';
import { useFarmovaSpeech } from './SpeechPlayer';

interface VoiceGuideContextValue {
  language: LanguageCode;
  voiceGuideEnabled: boolean;
  setVoiceGuideEnabled: (enabled: boolean) => void;
  activeFieldKey: FieldGuideKey | null;
  speakField: (fieldKey: FieldGuideKey, force?: boolean) => void;
  stopSpeech: () => void;
  clearActiveField: () => void;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
}

const VoiceGuideContext = createContext<VoiceGuideContextValue | null>(null);

export const VoiceGuideProvider: React.FC<{
  language: LanguageCode;
  children: React.ReactNode;
}> = ({ language, children }) => {
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState<boolean>(true);
  const [activeFieldKey, setActiveFieldKey] = useState<FieldGuideKey | null>(null);
  const { speak, stop, isSpeaking, isLoadingAudio } = useFarmovaSpeech(language);
  const lastSpokenRef = useRef<{ key: FieldGuideKey; lang: LanguageCode; at: number } | null>(null);

  useEffect(() => {
    stop();
    setActiveFieldKey(null);
  }, [language, stop]);

  const speakField = useCallback(
    (fieldKey: FieldGuideKey, force = false) => {
      setActiveFieldKey(fieldKey);
      if (!voiceGuideEnabled && !force) return;

      const now = Date.now();
      const prev = lastSpokenRef.current;
      if (!force && prev && prev.key === fieldKey && prev.lang === language && now - prev.at < 4500) {
        return;
      }

      const guide = FIELD_VOICE_GUIDES[fieldKey][language] ?? FIELD_VOICE_GUIDES[fieldKey].en;
      lastSpokenRef.current = { key: fieldKey, lang: language, at: now };
      speak(`${guide.instruction} ${guide.example}`);
    },
    [language, speak, voiceGuideEnabled]
  );

  const clearActiveField = useCallback(() => {
    setActiveFieldKey(null);
  }, []);

  return (
    <VoiceGuideContext.Provider
      value={{
        language,
        voiceGuideEnabled,
        setVoiceGuideEnabled,
        activeFieldKey,
        speakField,
        stopSpeech: stop,
        clearActiveField,
        isSpeaking,
        isLoadingAudio,
      }}
    >
      {children}
    </VoiceGuideContext.Provider>
  );
};

export function useVoiceGuide() {
  const ctx = useContext(VoiceGuideContext);
  if (!ctx) {
    throw new Error('useVoiceGuide must be used inside VoiceGuideProvider');
  }
  return ctx;
}

interface VoiceGuidedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  fieldKey: FieldGuideKey;
  value: string;
  onValueChange: (next: string) => void;
  leftIcon?: React.ReactNode;
  containerClassName?: string;
}

export const VoiceGuidedInput: React.FC<VoiceGuidedInputProps> = ({
  fieldKey,
  value,
  onValueChange,
  leftIcon,
  containerClassName = '',
  className = '',
  onFocus,
  type = 'text',
  ...rest
}) => {
  const { language, activeFieldKey, speakField, stopSpeech, isSpeaking, isLoadingAudio } = useVoiceGuide();
  const copy = UI_COPY[language];
  const guide = FIELD_VOICE_GUIDES[fieldKey][language] ?? FIELD_VOICE_GUIDES[fieldKey].en;
  const isFocused = activeFieldKey === fieldKey;

  const [dictating, setDictating] = useState(false);
  const [dictateFeedback, setDictateFeedback] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    speakField(fieldKey, false);
    onFocus?.(e);
  };

  const handleDictate = async () => {
    setDictateFeedback(null);
    stopSpeech();

    if (dictating && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setDictating(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (SpeechRec && language !== 'tw') {
      try {
        setDictating(true);
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
        rec.onresult = (ev) => {
          const transcript = (ev.results?.[0]?.[0]?.transcript ?? '').trim();
          if (transcript) {
            onValueChange(transcript);
            setDictateFeedback(transcript);
          }
        };
        rec.onerror = () => {
          setDictating(false);
        };
        rec.onend = () => setDictating(false);
        rec.start();
        return;
      } catch {
        setDictating(false);
      }
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        setDictating(true);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => chunks.push(ev.data);
        recorder.onstop = async () => {
          stream.getTracks().forEach((tr) => tr.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const b64 = String(reader.result).split(',')[1] ?? '';
            try {
              const res = await transcribeAudio({ audioBase64: b64, mimeType: blob.type, language });
              if (res.transcript) {
                onValueChange(res.transcript);
                setDictateFeedback(res.transcript);
              }
            } catch {
              setDictateFeedback('Voice capture unavailable; please type.');
            } finally {
              setDictating(false);
            }
          };
          reader.readAsDataURL(blob);
        };
        recorder.start();
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 4500);
      } catch {
        setDictating(false);
        setDictateFeedback('Microphone unavailable.');
      }
    }
  };

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      <div className="relative flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/45 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onFocus={handleFocus}
            className={`w-full min-h-[44px] ${leftIcon ? 'pl-10' : 'px-3.5'} pr-3.5 rounded-xl border text-sm bg-white text-[#1A1A1A] focus:outline-none transition-colors ${
              isFocused ? 'border-[#1F5A2E] ring-2 ring-[#1F5A2E]/15' : 'border-black/15'
            } ${className}`}
            {...rest}
          />
        </div>

        <button
          type="button"
          onClick={() => (isFocused && isSpeaking ? stopSpeech() : speakField(fieldKey, true))}
          disabled={isLoadingAudio}
          title={copy.voiceGuideSpeakHint}
          aria-label={copy.voiceGuideSpeakHint}
          className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
            isFocused && isSpeaking
              ? 'bg-[#A2461F] text-white border-[#A2461F]'
              : 'bg-[#F6EFE0] text-[#1F5A2E] border-black/10 hover:bg-[#EFE5CF]'
          }`}
        >
          {isFocused && isSpeaking ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {type !== 'date' && (
          <button
            type="button"
            onClick={handleDictate}
            title={dictating ? copy.voiceGuideListening : copy.voiceGuideDictate}
            aria-label={dictating ? copy.voiceGuideListening : copy.voiceGuideDictate}
            className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              dictating
                ? 'bg-[#A2461F] text-white border-[#A2461F]'
                : 'bg-white text-[#1A1A1A] border-black/15 hover:bg-black/5'
            }`}
          >
            {dictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isFocused && (
        <div className="px-3 py-2 rounded-xl bg-[#1F5A2E]/8 border border-[#1F5A2E]/20 text-xs text-[#1A1A1A] flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#1F5A2E]">{guide.title}</div>
            <div className="text-black/80">{guide.instruction}</div>
            <div className="text-black/55">{guide.example}</div>
            {dictateFeedback && (
              <div className="text-[#1F5A2E] font-medium">
                {dictating ? copy.voiceGuideListening : `→ ${dictateFeedback}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const VoiceGuideActiveBar: React.FC = () => {
  const { language, activeFieldKey, isSpeaking, speakField, stopSpeech, clearActiveField } = useVoiceGuide();
  const copy = UI_COPY[language];
  if (!activeFieldKey) return null;
  const guide = FIELD_VOICE_GUIDES[activeFieldKey][language] ?? FIELD_VOICE_GUIDES[activeFieldKey].en;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-30 bg-[#1F5A2E] text-white rounded-2xl border border-white/15 shadow-lg px-4 py-3 flex items-start justify-between gap-3">
      <div className="space-y-0.5 min-w-0">
        <div className="text-xs font-bold text-[#E3A72F]">{guide.title}</div>
        <p className="text-xs text-white/95 leading-snug">{guide.instruction}</p>
        <p className="text-[11px] text-white/75">{guide.example}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => (isSpeaking ? stopSpeech() : speakField(activeFieldKey, true))}
          className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold cursor-pointer"
          aria-label={isSpeaking ? copy.stopBtn : copy.replayBtn}
        >
          {isSpeaking ? copy.stopBtn : copy.replayBtn}
        </button>
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            clearActiveField();
          }}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
          aria-label="Close voice guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const translationMemoryCache = new Map<string, string[]>();

export function useTranslatedList(texts: string[], language: LanguageCode): string[] {
  const [translated, setTranslated] = useState<string[]>(texts);
  const key = `${language}::${texts.join('||')}`;

  useEffect(() => {
    if (language === 'en' || texts.length === 0) {
      setTranslated(texts);
      return;
    }

    const cached = translationMemoryCache.get(key);
    if (cached) {
      setTranslated(cached);
      return;
    }

    if (!navigator.onLine) {
      setTranslated(texts);
      return;
    }

    let cancelled = false;
    translateBatch(texts, language)
      .then((res) => {
        if (!cancelled && Array.isArray(res.translations) && res.translations.length === texts.length) {
          translationMemoryCache.set(key, res.translations);
          setTranslated(res.translations);
        }
      })
      .catch(() => {
        if (!cancelled) setTranslated(texts);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return language === 'en' ? texts : translated;
}
