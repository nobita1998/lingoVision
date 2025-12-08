
import React, { useState, useEffect, useCallback } from 'react';
import { 
  TargetLanguage, 
  NativeLanguage, 
  AnalysisResponse,
  HistoryItem
} from './types';
import { 
  LANGUAGE_OPTIONS, 
  NATIVE_LANGUAGE_OPTIONS, 
  LEVEL_OPTIONS,
  VOICE_OPTIONS, 
  DEFAULT_TARGET_LANGUAGE, 
  DEFAULT_NATIVE_LANGUAGE,
  DEFAULT_VOICE,
  TRANSLATIONS,
  PREVIEW_MESSAGES
} from './constants';
import { analyzeImage, synthesizeSpeech } from './services/geminiService';
import { decode, decodeAudioData, playAudioBuffer } from './services/audioUtils';
import { SYSTEM_VOICE_LOCALES } from './constants';
import { VOICE_PREVIEWS } from './voicePreviews';
import ImageDropzone from './components/ImageDropzone';
import AnalysisResult from './components/AnalysisResult';
import HistorySidebar from './components/HistorySidebar';

const HISTORY_KEY = 'lingovision_history';
const MAX_HISTORY_ITEMS = 10; // LocalStorage quota safety

const App: React.FC = () => {
  // Config State with LocalStorage Persistence
  
  const [targetLang, setTargetLang] = useState<TargetLanguage>(() => {
    return (localStorage.getItem('targetLang') as TargetLanguage) || DEFAULT_TARGET_LANGUAGE;
  });

  const [nativeLang, setNativeLang] = useState<NativeLanguage>(() => {
    return (localStorage.getItem('nativeLang') as NativeLanguage) || DEFAULT_NATIVE_LANGUAGE;
  });

  const [level, setLevel] = useState<string>(() => {
    const savedLevel = localStorage.getItem('level');
    const currentTarget = (localStorage.getItem('targetLang') as TargetLanguage) || DEFAULT_TARGET_LANGUAGE;
    const validLevels = LEVEL_OPTIONS[currentTarget] || LEVEL_OPTIONS[DEFAULT_TARGET_LANGUAGE];
    
    if (savedLevel && validLevels.includes(savedLevel)) {
      return savedLevel;
    }
    return validLevels[0];
  });

  const [voice, setVoice] = useState<string>(() => {
    return localStorage.getItem('voice') || DEFAULT_VOICE;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Data State
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Preview State
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Load History on Mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // Save History Helper
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save history (likely quota exceeded)", e);
      // If quota exceeded, try removing oldest
      if (newHistory.length > 1) {
        const reduced = newHistory.slice(0, -1);
        try {
           localStorage.setItem(HISTORY_KEY, JSON.stringify(reduced));
           setHistory(reduced);
        } catch (e2) {
          console.warn("Still cannot save history", e2);
        }
      }
    }
  };

  const addToHistory = (base64: string, result: AnalysisResponse, tLang: TargetLanguage, nLang: NativeLanguage, lvl: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageBase64: base64,
      result,
      targetLang: tLang,
      nativeLang: nLang,
      level: lvl
    };

    const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    saveHistory(updatedHistory);
    return newItem;
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setImageBase64(item.imageBase64);
    setAnalysisResult(item.result);
    setTargetLang(item.targetLang);
    setNativeLang(item.nativeLang);
    setLevel(item.level);
    setIsHistoryOpen(false);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHistoryDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    saveHistory(updated);
    
    // If deleting the currently viewed item, do we reset? 
    // For now, let's keep the view state as is to avoid jarring UX.
  };

  // Handlers for settings changes that persist to localStorage
  const handleNativeLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value as NativeLanguage;
    setNativeLang(newVal);
    localStorage.setItem('nativeLang', newVal);
  };

  const handleTargetLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value as TargetLanguage;
    setTargetLang(newVal);
    localStorage.setItem('targetLang', newVal);
    
    const defaultLevel = LEVEL_OPTIONS[newVal][0];
    setLevel(defaultLevel);
    localStorage.setItem('level', defaultLevel);
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setLevel(newVal);
    localStorage.setItem('level', newVal);
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setVoice(newVal);
    localStorage.setItem('voice', newVal);
  };

  const handleImageSelected = async (base64: string) => {
    setImageBase64(base64);
    setAnalysisResult(null);
    setError(null);
    setIsLoading(true);

    try {
      const result = await analyzeImage(base64, targetLang, nativeLang, level);
      setAnalysisResult(result);
      
      // Auto-save to history on success
      addToHistory(base64, result, targetLang, nativeLang, level);
    } catch (err: any) {
      console.error(err);
      setError(t.errorGeneric + " " + (err.message || ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoicePreview = async () => {
    if (isPreviewLoading || isPreviewPlaying) return;

    // --- 1. System Voice (Instant) ---
    if (voice === 'system') {
      setIsPreviewLoading(true); 
      window.speechSynthesis.cancel();
      const textToSay = PREVIEW_MESSAGES[targetLang];
      const utterance = new SpeechSynthesisUtterance(textToSay);
      utterance.lang = SYSTEM_VOICE_LOCALES[targetLang] || 'en-US'; 
      
      utterance.onstart = () => {
        setIsPreviewLoading(false);
        setIsPreviewPlaying(true);
      };
      utterance.onend = () => setIsPreviewPlaying(false);
      utterance.onerror = () => {
        setIsPreviewLoading(false);
        setIsPreviewPlaying(false);
      };
      
      window.speechSynthesis.speak(utterance);
      return;
    }

    // --- 2. Gemini Voice Cache ---
    const cacheKey = `${voice}-${targetLang}`;
    const hardcodedAudio = VOICE_PREVIEWS[cacheKey];

    if (hardcodedAudio && hardcodedAudio.length > 0) {
      try {
        setIsPreviewPlaying(true);
        const audioBytes = decode(hardcodedAudio);
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
        
        await playAudioBuffer(buffer, ctx, () => {
          setIsPreviewPlaying(false);
          ctx.close();
        });
        return;
      } catch (err) {
        console.warn("Failed to play hardcoded audio, falling back to API", err);
        setIsPreviewPlaying(false);
      }
    }

    // --- 3. Gemini Voice API ---
    try {
      setIsPreviewLoading(true);
      const textToSay = PREVIEW_MESSAGES[targetLang];
      const base64Audio = await synthesizeSpeech(textToSay, voice);
      
      console.log(`%c[PREVIEW CACHE] Copy the string below into voicePreviews.ts for key: "${cacheKey}"`, "color: #10B981; font-weight: bold;");
      console.log(base64Audio);

      const audioBytes = decode(base64Audio);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
      
      setIsPreviewLoading(false);
      setIsPreviewPlaying(true);
      
      await playAudioBuffer(buffer, ctx, () => {
        setIsPreviewPlaying(false);
        ctx.close();
      });
    } catch (err) {
      console.error("Preview failed", err);
      setIsPreviewLoading(false);
      setIsPreviewPlaying(false);
      alert("Failed to preview voice.");
    }
  };

  const reset = () => {
    setImageBase64(null);
    setAnalysisResult(null);
    setError(null);
  };

  const t = TRANSLATIONS[nativeLang] || TRANSLATIONS[NativeLanguage.English];
  const selectClass = "w-full pl-4 pr-10 py-3 bg-white border-2 border-black rounded-xl focus:outline-none focus:ring-0 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] text-slate-900 font-bold appearance-none cursor-pointer transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)]";

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b-4 border-black sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 border-2 border-black rounded-lg p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
               <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
               </svg>
            </div>
            <h1 className="text-3xl font-black text-black tracking-tight drop-shadow-sm">{t.appTitle}</h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* History Toggle */}
             <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 bg-orange-200 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
              title={t.historyTitle}
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Settings Toggle */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-white border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
              title={t.settingsTitle}
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-black">{t.settingsTitle}</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-lg font-black text-black ml-1">{t.nativeLabel}</label>
                <div className="relative">
                  <select value={nativeLang} onChange={handleNativeLangChange} className={selectClass}>
                    {NATIVE_LANGUAGE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-lg font-black text-black ml-1">{t.targetLabel}</label>
                <div className="relative">
                  <select value={targetLang} onChange={handleTargetLangChange} className={selectClass}>
                    {LANGUAGE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-lg font-black text-black ml-1">{t.levelLabel}</label>
                <div className="relative">
                  <select value={level} onChange={handleLevelChange} className={selectClass}>
                    {LEVEL_OPTIONS[targetLang].map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-lg font-black text-black ml-1">{t.voiceLabel}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={voice} onChange={handleVoiceChange} className={selectClass}>
                      {VOICE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <button onClick={handleVoicePreview} disabled={isPreviewLoading || isPreviewPlaying} className="bg-white border-2 border-black rounded-xl px-4 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all hover:bg-slate-50">
                     {isPreviewLoading ? (
                       <svg className="animate-spin h-6 w-6 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     ) : (
                       <svg className={`w-6 h-6 ${isPreviewPlaying ? 'text-green-600' : 'text-black'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                     )}
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-black text-white font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] hover:bg-slate-800 active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(100,100,100,1)] transition-all">
                  {t.closeButton}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <HistorySidebar 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        history={history}
        onSelect={handleHistorySelect}
        onDelete={handleHistoryDelete}
        text={t}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-black flex items-center gap-2">
              <span className="bg-green-400 text-white w-8 h-8 flex items-center justify-center rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">1</span>
              {t.uploadTitle}
            </h2>
            
            {!imageBase64 ? (
              <ImageDropzone onImageSelected={handleImageSelected} text={t} />
            ) : (
              <div className="relative rounded-3xl overflow-hidden border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group bg-white">
                <img 
                  src={imageBase64} 
                  alt="Uploaded" 
                  className="w-full h-auto object-cover max-h-[500px]" 
                />
                {/* Simplified View Only - actions moved to Result column for cleaner flow */}
              </div>
            )}

            {/* Instructions */}
            {!imageBase64 && (
              <div className="bg-sky-100 border-2 border-black p-5 rounded-2xl text-base font-medium text-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-1">
                <strong className="text-indigo-600 font-black">{t.tipTitle}</strong> {t.tipText}
              </div>
            )}
          </div>

          {/* Right Column: Output */}
          <div className="space-y-6">
            
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-2xl font-black text-black flex items-center gap-2">
                   <span className="bg-purple-400 text-white w-8 h-8 flex items-center justify-center rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">2</span>
                   {t.resultTitle}
                </h2>
                
                {/* Snap Another Button */}
                {(analysisResult || error) && !isLoading && (
                    <button
                      onClick={reset}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-black rounded-xl font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-2 whitespace-nowrap text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {t.snapAnother}
                    </button>
                )}
            </div>

            {isLoading && (
              <div className="h-80 flex flex-col items-center justify-center space-y-6 bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
                <div className="relative w-24 h-24 animate-bounce">
                   <div className="w-full h-full bg-yellow-400 rounded-full border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                     <svg className="w-12 h-12 text-black animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                   </div>
                </div>
                <div className="text-center">
                  <p className="text-black font-black text-xl">{t.analyzingTitle}</p>
                  <p className="text-slate-600 font-bold mt-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">{t.analyzingSubtitle} {level}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border-4 border-black text-red-900 p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-start gap-4">
                <div className="bg-red-500 rounded-full p-1 border-2 border-black flex-shrink-0 text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{error}</p>
                  <button onClick={reset} className="mt-4 text-sm font-bold underline hover:text-red-700">Try Again</button>
                </div>
              </div>
            )}

            {!isLoading && !analysisResult && !error && (
              <div className="h-80 flex flex-col items-center justify-center text-center p-8 border-4 border-dashed border-black/30 rounded-3xl text-slate-400 bg-white/50">
                <svg className="w-20 h-20 mb-4 text-slate-300 transform -rotate-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="font-bold text-lg text-slate-400">{t.waitingText}</p>
              </div>
            )}

            {!isLoading && analysisResult && (
              <AnalysisResult 
                data={analysisResult} 
                targetLanguage={targetLang} 
                voice={voice}
                text={t}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
