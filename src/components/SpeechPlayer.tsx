import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, RotateCcw, Square } from 'lucide-react';
import { synthesizeSpeech } from '../lib/api';
import { getLanguageMeta, UI_COPY } from '../lib/i18n';
import type { LanguageCode } from '../types';

export function useFarmovaSpeech(language: LanguageCode) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTextRef = useRef<string>('');
  const cachedAudioRef = useRef<Map<string, string>>(new Map());

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      stop();
      lastTextRef.current = text;
      setHasSpokenOnce(true);

      const cacheKey = `${language}:${text}`;
      const existingDataUrl = cachedAudioRef.current.get(cacheKey);

      const playDataUrl = (dataUrl: string) => {
        const audio = new Audio(dataUrl);
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        audio.play().catch(() => setIsSpeaking(false));
      };

      if (existingDataUrl) {
        playDataUrl(existingDataUrl);
        return;
      }

      if (navigator.onLine) {
        setIsLoadingAudio(true);
        try {
          const res = await synthesizeSpeech(text, language);
          const dataUrl = `data:${res.mimeType};base64,${res.audioBase64}`;
          cachedAudioRef.current.set(cacheKey, dataUrl);
          setIsLoadingAudio(false);
          playDataUrl(dataUrl);
          return;
        } catch {
          setIsLoadingAudio(false);
        }
      }

      // Browser Web Speech API fallback (works offline on Android/Chrome)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.92;
        utter.lang = getLanguageMeta(language).speechLang;
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utter);
      }
    },
    [language, stop]
  );

  const replay = useCallback(() => {
    if (lastTextRef.current) {
      speak(lastTextRef.current);
    }
  }, [speak]);

  return { speak, replay, stop, isSpeaking, isLoadingAudio, hasSpokenOnce };
}

export const SpeakButton: React.FC<{
  text: string;
  language: LanguageCode;
  className?: string;
  label?: string;
}> = ({ text, language, className = '', label }) => {
  const { speak, stop, isSpeaking, isLoadingAudio, hasSpokenOnce } = useFarmovaSpeech(language);
  const copy = UI_COPY[language];

  return (
    <button
      type="button"
      onClick={() => (isSpeaking ? stop() : speak(text))}
      disabled={isLoadingAudio}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl font-medium text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        isSpeaking
          ? 'bg-[#A2461F] text-white'
          : 'bg-[#1F5A2E]/10 text-[#1F5A2E] hover:bg-[#1F5A2E]/20'
      } ${className}`}
    >
      {isSpeaking ? (
        <>
          <Square className="w-4 h-4 fill-current" />
          <span>{copy.stopBtn}</span>
        </>
      ) : hasSpokenOnce ? (
        <>
          <RotateCcw className="w-4 h-4" />
          <span>{isLoadingAudio ? '...' : label ?? copy.replayBtn}</span>
        </>
      ) : (
        <>
          <Volume2 className="w-4 h-4" />
          <span>{isLoadingAudio ? '...' : label ?? copy.listenBtn}</span>
        </>
      )}
    </button>
  );
};
