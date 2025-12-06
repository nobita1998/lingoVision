import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResponse, TargetLanguage, NativeLanguage } from "../types";

// Helper to get fresh AI instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const retryDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const analyzeImage = async (
  imageBase64: string,
  targetLang: TargetLanguage,
  nativeLang: NativeLanguage,
  level: string
): Promise<AnalysisResponse> => {
  const ai = getAI();
  
  // Clean base64 string if it contains data URI prefix
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  const prompt = `
    You are an expert language tutor. 
    1. Analyze the attached image.
    2. Create a natural, descriptive caption for the image in ${targetLang} suitable for a learner at the "${level}" proficiency level. 
    3. Translate this caption into ${nativeLang}.
    4. Extract 3-6 key vocabulary words from the image that are relevant to this level.
    5. For each word, provide the word itself, its pronunciation guide (e.g., Hiragana/Furigana for Japanese, Pinyin for Chinese, or IPA/phonetic for others if useful, otherwise leave empty), its meaning in ${nativeLang}, and its part of speech.
    
    Return the result strictly as JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          caption: { type: Type.STRING, description: "The caption in the target language" },
          translatedCaption: { type: Type.STRING, description: `The caption translated to ${nativeLang}` },
          difficultyParams: { type: Type.STRING, description: "Short string describing the level used, e.g., 'JLPT N5'" },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                pronunciation: { type: Type.STRING, description: "Reading or pronunciation guide" },
                meaning: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
              },
            },
          },
        },
        required: ["caption", "translatedCaption", "vocabulary"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(response.text) as AnalysisResponse;
};

export const synthesizeSpeech = async (text: string, voiceName: string = 'Kore', retries = 3): Promise<string> => {
  const ai = getAI();
  const cleanText = text.trim();

  if (!cleanText) {
     throw new Error("Text is empty");
  }

  let lastError: any;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: {
          parts: [{ text: cleanText }],
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        return audioData;
      } else {
        throw new Error("Empty audio data in response");
      }
    } catch (e) {
      console.warn(`TTS attempt ${attempt + 1} failed for "${cleanText}":`, e);
      lastError = e;
      // Exponential backoff: 500ms, 1000ms, 2000ms
      if (attempt < retries - 1) {
        await retryDelay(500 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error("Failed to generate speech after retries");
};