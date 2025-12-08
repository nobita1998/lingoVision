
export enum TargetLanguage {
  English = 'English',
  Japanese = 'Japanese',
  Spanish = 'Spanish',
  French = 'French',
  Chinese = 'Chinese',
  German = 'German',
  Korean = 'Korean'
}

export enum NativeLanguage {
  Chinese = 'Chinese',
  English = 'English',
  Spanish = 'Spanish',
  Japanese = 'Japanese'
}

export interface VocabularyItem {
  word: string;
  pronunciation?: string; // For Kanji readings or IPA
  meaning: string;
  partOfSpeech: string;
}

export interface AnalysisResponse {
  caption: string;
  translatedCaption: string;
  vocabulary: VocabularyItem[];
  difficultyParams: string; // Just for context in UI
}

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  imageBase64: string;
  result: AnalysisResponse;
  targetLang: TargetLanguage;
  nativeLang: NativeLanguage;
  level: string;
}
