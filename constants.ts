import { TargetLanguage, NativeLanguage } from './types';

export const LANGUAGE_OPTIONS = [
  { value: TargetLanguage.English, label: '🇺🇸 English' },
  { value: TargetLanguage.Japanese, label: '🇯🇵 Japanese' },
  { value: TargetLanguage.Spanish, label: '🇪🇸 Spanish' },
  { value: TargetLanguage.French, label: '🇫🇷 French' },
  { value: TargetLanguage.Chinese, label: '🇨🇳 Chinese' },
  { value: TargetLanguage.German, label: '🇩🇪 German' },
  { value: TargetLanguage.Korean, label: '🇰🇷 Korean' },
];

export const NATIVE_LANGUAGE_OPTIONS = [
  { value: NativeLanguage.Chinese, label: '🇨🇳 Chinese (中文)' },
  { value: NativeLanguage.English, label: '🇺🇸 English' },
  { value: NativeLanguage.Japanese, label: '🇯🇵 Japanese (日本語)' },
  { value: NativeLanguage.Spanish, label: '🇪🇸 Spanish (Español)' },
];

export const VOICE_OPTIONS = [
  { value: 'system', label: '⚡ System Voice (Fastest)' },
  { value: 'Puck', label: 'Puck (Male)' },
  { value: 'Charon', label: 'Charon (Deep Male)' },
  { value: 'Kore', label: 'Kore (Female)' },
  { value: 'Fenrir', label: 'Fenrir (Deep Male)' },
  { value: 'Zephyr', label: 'Zephyr (Female)' },
];

// Map languages to BCP 47 tags for window.speechSynthesis
export const SYSTEM_VOICE_LOCALES: Record<string, string> = {
  [TargetLanguage.English]: 'en-US',
  [TargetLanguage.Japanese]: 'ja-JP',
  [TargetLanguage.Spanish]: 'es-ES',
  [TargetLanguage.French]: 'fr-FR',
  [TargetLanguage.Chinese]: 'zh-CN',
  [TargetLanguage.German]: 'de-DE',
  [TargetLanguage.Korean]: 'ko-KR',
  // 'English', 'Chinese', 'Japanese', 'Spanish' from NativeLanguage are duplicates of the above keys
};

// Preview messages in the TARGET language (what the user is learning)
export const PREVIEW_MESSAGES: Record<string, string> = {
  [TargetLanguage.English]: "Hello",
  [TargetLanguage.Japanese]: "こんにちは",
  [TargetLanguage.Spanish]: "Hola",
  [TargetLanguage.French]: "Bonjour",
  [TargetLanguage.Chinese]: "你好",
  [TargetLanguage.German]: "Hallo",
  [TargetLanguage.Korean]: "안녕하세요",
};

export const LEVEL_OPTIONS: Record<TargetLanguage, string[]> = {
  [TargetLanguage.English]: ['Beginner (A1)', 'Elementary (A2)', 'Intermediate (B1)', 'Upper Intermediate (B2)', 'Advanced (C1/TOEFL)', 'Mastery (C2/IELTS)'],
  [TargetLanguage.Japanese]: ['JLPT N5 (Beginner)', 'JLPT N4 (Basic)', 'JLPT N3 (Intermediate)', 'JLPT N2 (Pre-Advanced)', 'JLPT N1 (Advanced)'],
  [TargetLanguage.Spanish]: ['A1 (Acceso)', 'A2 (Plataforma)', 'B1 (Umbral)', 'B2 (Avanzado)', 'C1 (Dominio)', 'C2 (Maestría)'],
  [TargetLanguage.French]: ['A1 (Introductif)', 'A2 (Intermédiaire)', 'B1 (Seuil)', 'B2 (Avancé)', 'C1 (Autonome)', 'C2 (Maîtrise)'],
  [TargetLanguage.Chinese]: ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'],
  [TargetLanguage.German]: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  [TargetLanguage.Korean]: ['TOPIK I (Level 1)', 'TOPIK I (Level 2)', 'TOPIK II (Level 3)', 'TOPIK II (Level 4)', 'TOPIK II (Level 5)', 'TOPIK II (Level 6)'],
};

export const DEFAULT_TARGET_LANGUAGE = TargetLanguage.Japanese;
export const DEFAULT_NATIVE_LANGUAGE = NativeLanguage.Chinese;
export const DEFAULT_LEVEL = LEVEL_OPTIONS[TargetLanguage.Japanese][0];
export const DEFAULT_VOICE = 'Kore';

export const TRANSLATIONS = {
  [NativeLanguage.English]: {
    appTitle: "LingoVision",
    tagline: "Learn languages visually!",
    uploadTitle: "1. Upload Image",
    resultTitle: "2. Result",
    waitingText: "Waiting for your awesome photo!",
    analyzingTitle: "Thinking...",
    analyzingSubtitle: "Targeting",
    removeButton: "Remove & Upload New",
    tipTitle: "Tip:",
    tipText: "Upload a photo of your surroundings, a meal, or an object you want to learn about! 📸",
    settingsTitle: "Settings",
    nativeLabel: "I speak",
    targetLabel: "I want to learn",
    levelLabel: "Level",
    voiceLabel: "Voice",
    closeButton: "Done",
    uploadDragDrop: "Upload an image",
    uploadSubtext: "Drag & drop or click to browse",
    orDivider: "OR",
    cameraButton: "Take a Photo",
    captionLabel: "Caption",
    vocabLabel: "Vocabulary",
    errorGeneric: "Failed to analyze image. Please try again.",
    processing: "Processing..."
  },
  [NativeLanguage.Chinese]: {
    appTitle: "LingoVision",
    tagline: "视觉化语言学习！",
    uploadTitle: "1. 上传图片",
    resultTitle: "2. 学习结果",
    waitingText: "等待你的精彩照片！",
    analyzingTitle: "思考中...",
    analyzingSubtitle: "目标等级",
    removeButton: "删除并重新上传",
    tipTitle: "提示：",
    tipText: "上传周围环境、食物或你想学习的物体的照片！📸",
    settingsTitle: "设置",
    nativeLabel: "我讲",
    targetLabel: "我想学",
    levelLabel: "等级",
    voiceLabel: "发音音色",
    closeButton: "完成",
    uploadDragDrop: "上传图片",
    uploadSubtext: "拖放或点击浏览",
    orDivider: "或者",
    cameraButton: "拍照",
    captionLabel: "描述",
    vocabLabel: "词汇",
    errorGeneric: "分析图片失败。请重试。",
    processing: "处理中..."
  },
  [NativeLanguage.Japanese]: {
    appTitle: "LingoVision",
    tagline: "視覚で学ぶ語学！",
    uploadTitle: "1. 画像をアップロード",
    resultTitle: "2. 結果",
    waitingText: "素敵な写真を待っています！",
    analyzingTitle: "考え中...",
    analyzingSubtitle: "目標レベル",
    removeButton: "削除して再アップロード",
    tipTitle: "ヒント：",
    tipText: "周りの風景、食事、または学びたい物の写真をアップロードしてください！📸",
    settingsTitle: "設定",
    nativeLabel: "母国語",
    targetLabel: "学習言語",
    levelLabel: "レベル",
    voiceLabel: "音声",
    closeButton: "完了",
    uploadDragDrop: "画像をアップロード",
    uploadSubtext: "ドラッグ＆ドロップ、またはクリック",
    orDivider: "または",
    cameraButton: "写真を撮る",
    captionLabel: "キャプション",
    vocabLabel: "単語",
    errorGeneric: "画像の分析に失敗しました。もう一度お試しください。",
    processing: "処理中..."
  },
  [NativeLanguage.Spanish]: {
    appTitle: "LingoVision",
    tagline: "¡Aprende idiomas visualmente!",
    uploadTitle: "1. Subir Imagen",
    resultTitle: "2. Resultado",
    waitingText: "¡Esperando tu foto increíble!",
    analyzingTitle: "Pensando...",
    analyzingSubtitle: "Nivel objetivo",
    removeButton: "Eliminar y subir nueva",
    tipTitle: "Consejo:",
    tipText: "¡Sube una foto de tu entorno, una comida o un objeto que quieras aprender! 📸",
    settingsTitle: "Configuración",
    nativeLabel: "Yo hablo",
    targetLabel: "Quiero aprender",
    levelLabel: "Nivel",
    voiceLabel: "Voz",
    closeButton: "Listo",
    uploadDragDrop: "Subir una imagen",
    uploadSubtext: "Arrastra y suelta o haz clic para buscar",
    orDivider: "O",
    cameraButton: "Tomar una foto",
    captionLabel: "Descripción",
    vocabLabel: "Vocabulario",
    errorGeneric: "Error al analizar la imagen. Por favor intenta de nuevo.",
    processing: "Procesando..."
  }
};