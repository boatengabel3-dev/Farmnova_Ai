import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Mic, MicOff, Send, X } from 'lucide-react';
import { askAlpha, transcribeAudio } from '../lib/api';
import { SUPPORTED_LANGUAGES } from '../lib/i18n';
import type { FarmRecord, LanguageCapabilities, LanguageCode } from '../types';
import { SpeakButton } from './SpeechPlayer';
import { useTranslatedList, VoiceGuidedInput } from './VoiceGuidedField';

interface AlphaMessage {
  id: string;
  role: 'farmer' | 'alpha';
  text: string;
  provider?: string;
}

interface AlphaAssistantProps {
  open: boolean;
  onClose: () => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  farm: FarmRecord | null;
  langCapabilities: LanguageCapabilities | null;
}

const WELCOME_MESSAGES: Record<LanguageCode, string> = {
  en: "Hello! I'm Alpha, your Farmova farming guide. Ask me about your farm conditions, rainfall update, or what to plant next.",
  tw: 'Akwaaba! Me din de Alpha. Bisa me asɛm biara fa w’afuw, nsuo tebea, anaa afifideɛ a ɛsɛ sɛ wudua akyiri yi ho.',
  fr: 'Bonjour ! Je suis Alpha, votre guide agricole Farmova. Posez-moi vos questions sur votre champ, la pluie ou la prochaine culture.',
  es: '¡Hola! Soy Alpha, tu guía agrícola de Farmova. Pregúntame sobre el estado de tu finca, la lluvia o qué sembrar después.',
  pt: 'Olá! Sou o Alpha, seu guia agrícola Farmova. Pergunte sobre sua lavoura, chuvas ou qual cultura plantar na sequência.',
  sw: 'Habari! Mimi ni Alpha, mshauri wako wa kilimo wa Farmova. Niulize kuhusu hali ya shamba, mvua, au zao la kupanda.',
  hi: 'नमस्ते! मैं अल्फा हूँ, आपका फार्मॉवा कृषि मार्गदर्शक। मुझसे अपने खेत की स्थिति, बारिश या अगली फसल के बारे में पूछें।',
  ar: 'مرحباً! أنا ألفا، مرشدك الزراعي في فارموفا. اسألني عن حالة مزرعتك أو الأمطار أو المحصول المناسب للزراعة.',
};

const ALPHA_PLACEHOLDERS: Record<LanguageCode, string> = {
  en: 'Ask Alpha about your farm...',
  tw: 'Kyerɛw asɛmmisa wɔ ha...',
  fr: 'Posez votre question à Alpha...',
  es: 'Pregunta a Alpha sobre tu finca...',
  pt: 'Pergunte ao Alpha sobre sua fazenda...',
  sw: 'Uliza Alpha kuhusu shamba lako...',
  hi: 'अपने खेत के बारे में अल्फा से पूछें...',
  ar: 'اسأل ألفا عن مزرعتك...',
};

export const AlphaAssistant: React.FC<AlphaAssistantProps> = ({
  open,
  onClose,
  language,
  onLanguageChange,
  farm,
  langCapabilities,
}) => {
  const [messages, setMessages] = useState<AlphaMessage[]>([
    {
      id: 'welcome',
      role: 'alpha',
      text: WELCOME_MESSAGES[language] ?? WELCOME_MESSAGES.en,
      provider: 'Alpha Guide',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'welcome'
        ? [{ ...prev[0], text: WELCOME_MESSAGES[language] ?? WELCOME_MESSAGES.en }]
        : prev
    );
  }, [language]);

  const baseQuickPrompts = useMemo(
    () => [
      'What is my 7-14 day soil moisture prediction?',
      'Are there any drought, flood, or NASA EONET hazard risks?',
      'Why do you recommend this next crop?',
      'When is the best window to plant my next crop?',
    ],
    []
  );
  const translatedQuickPrompts = useTranslatedList(baseQuickPrompts, language);

  if (!open) return null;

  const sendQuestion = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    const userMsg: AlphaMessage = { id: `u-${Date.now()}`, role: 'farmer', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setVoiceStatus(null);

    try {
      const res = await askAlpha({
        question: trimmed,
        language,
        farmId: farm?.id ?? null,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'alpha',
          text: res.reply,
          provider: res.provider,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'alpha',
          text:
            language === 'tw'
              ? 'Mepa wo kyɛw, intanɛt nni hɔ seesei. Nanso wobɛtumi akenkan w’afuw ho nsɛm a yɛakora no.'
              : 'I could not reach the server right now. Your saved farm update on the home screen remains available offline.',
          provider: 'Offline Notice',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = async () => {
    setVoiceStatus(null);
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const b64 = String(reader.result).split(',')[1] ?? '';
            setLoading(true);
            try {
              const res = await transcribeAudio({ audioBase64: b64, mimeType: blob.type, language });
              setLoading(false);
              if (res.transcript) {
                await sendQuestion(res.transcript);
              } else {
                setVoiceStatus('Could not hear speech clearly. Please type or tap a quick question below.');
              }
            } catch {
              setLoading(false);
              setVoiceStatus('Voice transcription unavailable right now — please type or tap a quick topic below.');
            }
          };
          reader.readAsDataURL(blob);
        };
        recorder.start();
        setRecording(true);
      } catch {
        setVoiceStatus('Microphone access denied or unavailable. Use typing or quick topic buttons below.');
      }
    } else {
      setVoiceStatus('Voice recording is not supported on this browser. Please type or tap a quick topic.');
    }
  };

  const quickPrompts =
    language === 'tw'
      ? [
          'Kyerɛ me nsuo ne asase mu fɔ nkɔmhyɛ no ase.',
          'Wiem asiane anaa ogya/nsuyiri kɔkɔbɔ bi wɔ hɔ anaa?',
          'Afifideɛ bɛn na ɛsɛ sɛ medua akyiri yi?',
          'Berɛ bɛn na ɛfata sɛ medua afifideɛ foforɔ?',
        ]
      : translatedQuickPrompts;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg h-[88vh] sm:h-[640px] bg-[#F6EFE0] rounded-t-3xl sm:rounded-3xl border border-black/15 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1F5A2E] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#E3A72F] text-[#1A1A1A] flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base truncate">Alpha Farming Guide</div>
              <div className="text-xs text-white/80 truncate">
                {language === 'tw' && langCapabilities?.khayaConfigured
                  ? 'Khaya AI Twi + Grounded NASA Guide'
                  : 'Grounded in Verified Farmova Data'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              aria-label="Alpha language"
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-xs font-semibold text-white cursor-pointer focus:outline-none"
            >
              {SUPPORTED_LANGUAGES.map((langOpt) => (
                <option key={langOpt.code} value={langOpt.code} className="text-[#1A1A1A] bg-white">
                  {langOpt.nativeLabel}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              aria-label="Close Alpha"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'farmer' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'farmer'
                    ? 'bg-[#1F5A2E] text-white'
                    : 'bg-white border border-black/10 text-[#1A1A1A]'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.role === 'alpha' && (
                  <div className="mt-2.5 pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
                    <SpeakButton text={m.text} language={language} className="min-h-[36px] px-3 py-1 text-xs" />
                    {m.provider && <span className="text-[11px] text-black/50">{m.provider}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-xs text-black/60 px-2">
              {language === 'tw' ? 'Alpha resusuw ho...' : 'Alpha is checking your farm update...'}
            </div>
          )}
        </div>

        {/* Quick Tap Prompts */}
        <div className="px-4 py-2 border-t border-black/10 bg-white/70 flex gap-2 overflow-x-auto">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => sendQuestion(qp)}
              className="px-3 py-1.5 rounded-xl bg-[#F6EFE0] border border-black/10 text-xs font-medium text-[#1A1A1A] hover:bg-[#EFE5CF] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Voice / Text Input */}
        <div className="p-3 bg-white border-t border-black/10 space-y-2">
          {voiceStatus && <p className="text-xs text-[#A2461F] px-1">{voiceStatus}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="flex items-start gap-2"
          >
            <button
              type="button"
              onClick={toggleRecording}
              className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                recording
                  ? 'bg-[#A2461F] text-white'
                  : 'bg-[#F6EFE0] text-[#1F5A2E] border border-black/10 hover:bg-[#EFE5CF]'
              }`}
              aria-label={recording ? 'Stop recording' : 'Speak & send to Alpha'}
              title={recording ? 'Tap to stop & send' : 'Tap to speak & send'}
            >
              {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <VoiceGuidedInput
              fieldKey="alpha_question"
              value={input}
              onValueChange={setInput}
              placeholder={ALPHA_PLACEHOLDERS[language] ?? ALPHA_PLACEHOLDERS.en}
              containerClassName="flex-1"
            />

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#1F5A2E] text-white flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

