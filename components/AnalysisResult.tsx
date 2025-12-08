
import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResponse, TargetLanguage } from '../types';
import { synthesizeSpeech } from '../services/geminiService';
import { decode, decodeAudioData, playAudioBuffer } from '../services/audioUtils';
import { SYSTEM_VOICE_LOCALES } from '../constants';

interface AnalysisResultProps {
  data: AnalysisResponse;
  targetLanguage: TargetLanguage;
  voice: string;
  text: any;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, targetLanguage, voice, text }) => {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null); // 'caption' or word string
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  
  // Cache to store decoded AudioBuffers for Gemeni Voices
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false;
      // Stop system speech if unmounting
      window.speechSynthesis.cancel();
    };
  }, []);

  // Pre-load audio when data OR voice changes (Only for Gemini voices)
  useEffect(() => {
    // If using system voice, do NOT preload, it is instant.
    if (voice === 'system') {
      return;
    }

    const preloadAudio = async () => {
      const fetchAndCache = async (txt: string, baseId: string) => {
        if (!mountedRef.current) return;
        const cacheKey = `${voice}-${baseId}`;
        if (audioCache.current.has(cacheKey)) return;

        try {
          const base64Audio = await synthesizeSpeech(txt, voice);
          const audioBytes = decode(base64Audio);
          const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          const buffer = await decodeAudioData(audioBytes, tempCtx, 24000, 1);
          await tempCtx.close();

          if (mountedRef.current) {
            audioCache.current.set(cacheKey, buffer);
          }
        } catch (error) {
          console.warn(`Failed to preload audio for ${cacheKey}:`, error);
        }
      };

      const tasks = [
        fetchAndCache(data.caption, 'caption'),
        ...data.vocabulary.map((item, index) => fetchAndCache(item.word, `word-${index}`))
      ];

      await Promise.allSettled(tasks);
    };

    preloadAudio();
  }, [data, targetLanguage, voice]);

  const handlePlayAudio = async (textToPlay: string, baseId: string) => {
    if (playingAudio) return; // Prevent overlapping playback
    
    // --- System Voice (Instant) ---
    if (voice === 'system') {
      window.speechSynthesis.cancel(); // Stop any current speech
      const utterance = new SpeechSynthesisUtterance(textToPlay);
      utterance.lang = SYSTEM_VOICE_LOCALES[targetLanguage] || 'en-US';
      
      utterance.onstart = () => {
        if (mountedRef.current) setPlayingAudio(baseId);
      };
      utterance.onend = () => {
        if (mountedRef.current) setPlayingAudio(null);
      };
      utterance.onerror = () => {
        if (mountedRef.current) setPlayingAudio(null);
      };
      
      window.speechSynthesis.speak(utterance);
      return;
    }

    // --- Gemini Voice (Network) ---
    const cacheKey = `${voice}-${baseId}`;

    try {
      let buffer = audioCache.current.get(cacheKey);

      // If not in cache, fetch it now
      if (!buffer) {
        setLoadingAudio(baseId);
        const base64Audio = await synthesizeSpeech(textToPlay, voice);
        const audioBytes = decode(base64Audio);
        const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        buffer = await decodeAudioData(audioBytes, tempCtx, 24000, 1);
        await tempCtx.close();
        
        if (mountedRef.current) {
          audioCache.current.set(cacheKey, buffer);
        }
        setLoadingAudio(null);
      }

      if (buffer) {
        const playCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        setPlayingAudio(baseId);
        await playAudioBuffer(buffer, playCtx, () => {
          if (mountedRef.current) {
            setPlayingAudio(null);
          }
          playCtx.close();
        });
      }

    } catch (error) {
      console.error("Audio playback error:", error);
      setLoadingAudio(null);
      setPlayingAudio(null);
      alert("Could not play audio. Please try again or switch to System Voice.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Caption Section */}
      <div className="mb-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-black text-black uppercase tracking-wide bg-yellow-400 px-2 py-0.5 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{text.captionLabel}</h3>
            <button
              onClick={() => handlePlayAudio(data.caption, 'caption')}
              disabled={!!playingAudio || (!!loadingAudio && loadingAudio !== 'caption')}
              className={`p-2 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:shadow-none active:translate-x-[1px] active:translate-y-[1px] ${playingAudio === 'caption' ? 'bg-green-400 text-black' : 'bg-white text-black hover:bg-green-100'}`}
              title="Listen to caption"
            >
              {loadingAudio === 'caption' ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-black mb-2 leading-relaxed">{data.caption}</p>
          <p className="text-base sm:text-lg text-slate-600 italic font-medium">{data.translatedCaption}</p>
          
          <div className="mt-3 inline-block bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            {data.difficultyParams}
          </div>
      </div>

      {/* Vocabulary Section */}
      <div>
        <h3 className="text-lg font-black text-black flex items-center gap-2 mb-3">
          <span className="bg-pink-400 w-6 h-6 rounded border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-white text-sm">V</span>
          {text.vocabLabel}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.vocabulary.map((item, idx) => (
             <div key={idx} className="bg-white p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-start justify-between hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
                <div>
                   <p className="text-base font-black text-black">{item.word}</p>
                   {item.pronunciation && <p className="text-xs text-slate-500 font-medium">{item.pronunciation}</p>}
                   <p className="text-sm text-slate-700 mt-0.5">{item.meaning}</p>
                   <span className="inline-block mt-1 text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 text-slate-500">{item.partOfSpeech}</span>
                </div>
                <button
                  onClick={() => handlePlayAudio(item.word, `word-${idx}`)}
                  disabled={!!playingAudio || (!!loadingAudio && loadingAudio !== `word-${idx}`)}
                  className={`p-1.5 rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] ${playingAudio === `word-${idx}` ? 'bg-green-400' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  {loadingAudio === `word-${idx}` ? (
                     <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                  ) : (
                    <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
