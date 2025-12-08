
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
const MAX_HISTORY_ITEMS = 10; 

const App: React.FC = () => {
  // Config State
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
    return (savedLevel && validLevels.includes(savedLevel)) ? savedLevel : validLevels[0];
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

  // UI View State: 'upload' | 'image' | 'card'
  const [viewMode, setViewMode] = useState<'upload' | 'image' | 'card'>('upload');

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Load History
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) { console.error(e); }
  }, []);

  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)); } catch (e) { console.error(e); }
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
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setImageBase64(item.imageBase64);
    setAnalysisResult(item.result);
    setTargetLang(item.targetLang);
    setNativeLang(item.nativeLang);
    setLevel(item.level);
    setIsHistoryOpen(false);
    setError(null);
    setViewMode('card'); // Jump straight to card view
  };

  const handleHistoryDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    saveHistory(history.filter(h => h.id !== id));
  };

  // Config Handlers
  const handleNativeLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as NativeLanguage;
    setNativeLang(val);
    localStorage.setItem('nativeLang', val);
  };
  const handleTargetLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as TargetLanguage;
    setTargetLang(val);
    localStorage.setItem('targetLang', val);
    const def = LEVEL_OPTIONS[val][0];
    setLevel(def);
    localStorage.setItem('level', def);
  };
  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLevel(e.target.value);
    localStorage.setItem('level', e.target.value);
  };
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setVoice(e.target.value);
    localStorage.setItem('voice', e.target.value);
  };

  const handleImageSelected = async (base64: string) => {
    setImageBase64(base64);
    setAnalysisResult(null);
    setError(null);
    setIsLoading(true);
    setViewMode('image'); // Switch to image view while loading

    try {
      const result = await analyzeImage(base64, targetLang, nativeLang, level);
      setAnalysisResult(result);
      addToHistory(base64, result, targetLang, nativeLang, level);
      setViewMode('card'); // Auto open card on success
    } catch (err: any) {
      console.error(err);
      setError(t.errorGeneric + " " + (err.message || ""));
      setViewMode('image'); // Stay on image if error, error will overlay
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoicePreview = async () => {
    if (isPreviewLoading || isPreviewPlaying) return;
    if (voice === 'system') {
      setIsPreviewLoading(true); 
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(PREVIEW_MESSAGES[targetLang]);
      u.lang = SYSTEM_VOICE_LOCALES[targetLang] || 'en-US'; 
      u.onstart = () => { setIsPreviewLoading(false); setIsPreviewPlaying(true); };
      u.onend = () => setIsPreviewPlaying(false);
      u.onerror = () => { setIsPreviewLoading(false); setIsPreviewPlaying(false); };
      window.speechSynthesis.speak(u);
      return;
    }

    const cacheKey = `${voice}-${targetLang}`;
    const hardcoded = VOICE_PREVIEWS[cacheKey];

    const play = async (b64: string) => {
       const bytes = decode(b64);
       const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
       const buf = await decodeAudioData(bytes, ctx, 24000, 1);
       setIsPreviewPlaying(true);
       await playAudioBuffer(buf, ctx, () => { setIsPreviewPlaying(false); ctx.close(); });
    };

    if (hardcoded) {
      try { await play(hardcoded); return; } catch(e) { console.warn(e); }
    }

    try {
      setIsPreviewLoading(true);
      const b64 = await synthesizeSpeech(PREVIEW_MESSAGES[targetLang], voice);
      setIsPreviewLoading(false);
      await play(b64);
    } catch (err) {
      setIsPreviewLoading(false);
      alert("Voice preview failed.");
    }
  };

  const reset = () => {
    setImageBase64(null);
    setAnalysisResult(null);
    setError(null);
    setViewMode('upload');
  };

  const t = TRANSLATIONS[nativeLang] || TRANSLATIONS[NativeLanguage.English];
  const selectClass = "w-full pl-4 pr-10 py-3 bg-white border-2 border-black rounded-xl focus:outline-none focus:ring-0 text-slate-900 font-bold appearance-none cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all";

  return (
    <div className="min-h-screen pb-12 bg-[#FEF3C7] text-slate-900 font-['Fredoka']">
      
      {/* --- Header --- */}
      <header className="bg-white border-b-4 border-black sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
            <div className="bg-yellow-400 border-2 border-black rounded-lg p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
               <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
               </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">{t.appTitle}</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 bg-orange-200 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-white border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* --- Settings Modal --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-black">{t.settingsTitle}</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-lg font-black text-black mb-1">{t.nativeLabel}</label>
                <div className="relative">
                  <select value={nativeLang} onChange={handleNativeLangChange} className={selectClass}>
                    {NATIVE_LANGUAGE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></div>
                </div>
              </div>
              <div>
                <label className="block text-lg font-black text-black mb-1">{t.targetLabel}</label>
                <div className="relative">
                  <select value={targetLang} onChange={handleTargetLangChange} className={selectClass}>
                    {LANGUAGE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></div>
                </div>
              </div>
              <div>
                <label className="block text-lg font-black text-black mb-1">{t.levelLabel}</label>
                <div className="relative">
                  <select value={level} onChange={handleLevelChange} className={selectClass}>
                    {LEVEL_OPTIONS[targetLang].map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></div>
                </div>
              </div>
              <div>
                <label className="block text-lg font-black text-black mb-1">{t.voiceLabel}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={voice} onChange={handleVoiceChange} className={selectClass}>
                      {VOICE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-black"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></div>
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

      {/* --- History Sidebar --- */}
      <HistorySidebar 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        history={history}
        onSelect={handleHistorySelect}
        onDelete={handleHistoryDelete}
        text={t}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* State 1: Upload (Empty) */}
        {viewMode === 'upload' && !imageBase64 && (
          <div className="max-w-2xl mx-auto mt-12 animate-fade-in-up">
             <div className="text-center mb-8">
               <h2 className="text-4xl font-black text-black mb-2">{t.uploadTitle}</h2>
               <p className="text-slate-600 font-medium text-lg">
                 {t.tipTitle} {t.tipText}
               </p>
             </div>
             <ImageDropzone onImageSelected={handleImageSelected} text={t} />
          </div>
        )}

        {/* State 2 & 3: Interactive Container (Image or Card Mode) */}
        {imageBase64 && (
          <div className="relative w-full h-[600px] sm:h-[650px] bg-slate-100 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden transition-all duration-300">
            
            {/* --- 1. Image Layer --- */}
            <div 
              className={`absolute transition-all duration-500 ease-in-out z-20 ${
                viewMode === 'card' 
                  ? 'top-4 left-4 w-28 h-28 sm:w-32 sm:h-32 rounded-xl border-4 border-white shadow-lg cursor-pointer hover:scale-105'
                  : 'inset-0 w-full h-full'
              }`}
              onClick={() => viewMode === 'card' && setViewMode('image')}
            >
               <img 
                 src={imageBase64} 
                 alt="Subject" 
                 className={`w-full h-full object-cover ${viewMode === 'card' ? 'rounded-lg' : ''}`}
               />
               
               {/* Expand hint (only in card mode) */}
               {viewMode === 'card' && (
                 <div className="absolute inset-0 bg-black/20 hover:bg-black/10 transition-colors flex items-center justify-center rounded-lg">
                    <svg className="w-8 h-8 text-white drop-shadow-md opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                 </div>
               )}
            </div>

            {/* --- Loading Overlay (Centered) --- */}
            {isLoading && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-3xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center animate-bounce">
                   <div className="w-16 h-16 bg-yellow-400 rounded-full border-4 border-black flex items-center justify-center mb-3">
                     <svg className="w-8 h-8 text-black animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                   </div>
                   <p className="font-black text-lg">{t.analyzingTitle}</p>
                   <p className="text-sm font-bold text-slate-500">{t.analyzingSubtitle} {level}</p>
                </div>
              </div>
            )}

             {/* --- Error Overlay --- */}
             {error && !isLoading && (
               <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
                 <div className="bg-red-100 border-4 border-black p-6 rounded-3xl max-w-sm text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <p className="font-bold text-red-800 text-lg mb-4">{error}</p>
                    <button onClick={reset} className="px-6 py-2 bg-white border-2 border-black rounded-xl font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none transition-all">
                      Try Again
                    </button>
                 </div>
               </div>
             )}


            {/* --- 2. Learning Card (Slide Panel) --- */}
            <div 
              className={`absolute top-0 right-0 h-full w-full bg-white transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 flex flex-col ${
                viewMode === 'card' ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
               {/* Card Header (with space for thumbnail on left) */}
               <div className="h-40 bg-yellow-100 border-b-4 border-black p-4 flex items-start justify-end">
                  {/* Close/Back Button */}
                  <button 
                    onClick={() => setViewMode('image')}
                    className="p-2 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                  >
                    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
               </div>

               {/* Scrollable Content */}
               <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                  <div className="max-w-3xl mx-auto">
                    {/* Regenerate/New Actions */}
                    <div className="flex justify-end gap-3 mb-6">
                        <button
                          onClick={() => imageBase64 && handleImageSelected(imageBase64)}
                          className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-xl font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] text-sm flex items-center gap-2"
                        >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                           {t.regenerateButton}
                        </button>
                        <button
                          onClick={reset}
                          className="px-4 py-2 bg-white hover:bg-slate-50 text-black rounded-xl font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] text-sm flex items-center gap-2"
                        >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                           {t.snapAnother}
                        </button>
                    </div>

                    {/* Result Component */}
                    {analysisResult && (
                      <AnalysisResult 
                        data={analysisResult}
                        targetLanguage={targetLang}
                        voice={voice}
                        text={t}
                      />
                    )}
                  </div>
               </div>
            </div>

            {/* --- 3. View Toggle (Visible in Image Mode) --- */}
            {viewMode === 'image' && analysisResult && (
               <button
                 onClick={() => setViewMode('card')}
                 className="absolute bottom-6 right-6 z-20 bg-white text-black font-black py-3 px-6 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:scale-105 active:scale-95 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 animate-pulse-slow"
               >
                 <span>View Learning Card</span>
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
               </button>
            )}

            {/* --- "Peek" Badge (Top Right in Image Mode) --- */}
            {viewMode === 'image' && analysisResult && (
               <div className="absolute top-6 right-6 z-20">
                 <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    Result Ready
                 </span>
               </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
};

export default App;
