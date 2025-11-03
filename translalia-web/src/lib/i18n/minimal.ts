export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' as const },
  { code: 'es', name: 'Spanish', dir: 'ltr' as const },
  { code: 'hi', name: 'Hindi', dir: 'ltr' as const },
  { code: 'ar', name: 'Arabic', dir: 'rtl' as const },
  { code: 'bn', name: 'Bengali', dir: 'ltr' as const },
  { code: 'zh', name: 'Chinese', dir: 'ltr' as const },
  { code: 'fr', name: 'French', dir: 'ltr' as const },
  { code: 'el', name: 'Greek', dir: 'ltr' as const },
  { code: 'it', name: 'Italian', dir: 'ltr' as const },
  { code: 'mr', name: 'Marathi', dir: 'ltr' as const },
  { code: 'pt', name: 'Portuguese', dir: 'ltr' as const },
  { code: 'ta', name: 'Tamil', dir: 'ltr' as const },
  { code: 'te', name: 'Telugu', dir: 'ltr' as const },
];

// Minimal translations - only strings we're touching in this sprint
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    'guide.title': "Let's get started",
    'guide.poemPlaceholder': 'Paste the original text here...',
    'guide.normalizeSpacing': 'Normalize spacing (collapse extra blank lines)',
    'guide.translationZone': 'Translation Zone',
    'guide.translationZoneHelper': 'Briefly describe what zone of language you want to translate into',
    'guide.translationZoneExamples': 'Examples: Hindi, Singlish, Rioplatense Spanish, a mix of French and Italian, medieval German, the whole range of world Englishes',
    'guide.translationIntent': 'Translation Intent',
    'guide.translationIntentHelper': 'Briefly describe your intention or goal for the translation',
    'guide.translationIntentExamples': 'Examples: make it funny, make it sad, make it accessible to children, make it rhyme, make it poetic, make it political, make it spiritual',
    'guide.saveZone': 'Save Zone',
    'guide.saveIntent': 'Save Intent',
    'guide.edit': 'Edit',
    'guide.updateZone': 'Update Zone',
    'guide.updateIntent': 'Update Intent',
    'guide.locked': 'Locked - translation in progress. Clear translations to change formatting.',
    'workshop.sourceWords': 'Source text words',
    'workshop.sourceWordsHelper': 'Drag these to keep the original words in your translation',
    'workshop.selectLine': 'Select a line to translate',
    'notebook.compare': 'Compare',
  },
  es: {
    'guide.title': 'Empecemos',
    'guide.poemPlaceholder': 'Pega el texto original aquí...',
    'guide.normalizeSpacing': 'Normalizar espaciado',
    'guide.translationZone': 'Zona de traducción',
    'guide.translationZoneHelper': 'Describe brevemente la zona lingüística a la que quieres traducir',
    'guide.translationZoneExamples': 'Ejemplos: Hindi, Spanglish, español rioplatense, una mezcla de francés e italiano, alemán medieval, toda la gama de ingleses del mundo',
    'guide.translationIntent': 'Intención de traducción',
    'guide.translationIntentHelper': 'Describe brevemente tu intención u objetivo para la traducción',
    'guide.translationIntentExamples': 'Ejemplos: hacerlo divertido, hacerlo triste, hacerlo accesible para niños, hacerlo rimar, hacerlo poético, hacerlo político, hacerlo espiritual',
    'guide.saveZone': 'Guardar Zona',
    'guide.saveIntent': 'Guardar Intención',
    'guide.edit': 'Editar',
    'guide.updateZone': 'Actualizar Zona',
    'guide.updateIntent': 'Actualizar Intención',
    'guide.locked': 'Bloqueado - traducción en progreso. Borra las traducciones para cambiar el formato.',
    'workshop.sourceWords': 'Palabras del texto original',
    'workshop.selectLine': 'Selecciona una línea para traducir',
    'notebook.compare': 'Comparar',
  },
  hi: {
    'guide.title': 'शुरू करें',
    'guide.poemPlaceholder': 'मूल पाठ यहाँ पेस्ट करें...',
    'guide.normalizeSpacing': 'रिक्ति को सामान्य करें',
    'guide.translationZone': 'अनुवाद क्षेत्र',
    'guide.translationZoneHelper': 'भाषा क्षेत्र का संक्षेप में वर्णन करें जिसमें आप अनुवाद करना चाहते हैं',
    'guide.translationIntent': 'अनुवाद उद्देश्य',
    'guide.translationIntentHelper': 'अनुवाद के लिए अपने इरादे या लक्ष्य का संक्षेप में वर्णन करें',
    'guide.saveZone': 'क्षेत्र सहेजें',
    'guide.saveIntent': 'उद्देश्य सहेजें',
    'guide.edit': 'संपादित करें',
    'guide.updateZone': 'क्षेत्र अपडेट करें',
    'guide.updateIntent': 'उद्देश्य अपडेट करें',
    'guide.locked': 'लॉक - अनुवाद प्रगति में है। स्वरूपण बदलने के लिए अनुवाद साफ़ करें।',
    'workshop.selectLine': 'अनुवाद के लिए एक पंक्ति चुनें',
    'notebook.compare': 'तुलना करें',
  },
  ar: {
    'guide.title': 'لنبدأ',
    'guide.poemPlaceholder': 'الصق النص الأصلي هنا...',
    'guide.normalizeSpacing': 'تطبيع المسافات',
    'guide.translationZone': 'منطقة الترجمة',
    'guide.translationZoneHelper': 'صف بإيجاز منطقة اللغة التي تريد الترجمة إليها',
    'guide.translationIntent': 'نية الترجمة',
    'guide.translationIntentHelper': 'صف بإيجاز نيتك أو هدفك للترجمة',
    'guide.saveZone': 'حفظ المنطقة',
    'guide.saveIntent': 'حفظ النية',
    'guide.edit': 'تعديل',
    'guide.updateZone': 'تحديث المنطقة',
    'guide.updateIntent': 'تحديث النية',
    'guide.locked': 'مقفلة - الترجمة قيد التقدم. امسح الترجمات لتغيير التنسيق.',
    'workshop.selectLine': 'اختر سطرًا للترجمة',
    'notebook.compare': 'مقارنة',
  },
  bn: {
    'guide.title': 'শুরু করি',
    'guide.poemPlaceholder': 'মূল পাঠ এখানে পেস্ট করুন...',
    'guide.translationZone': 'অনুবাদ অঞ্চল',
    'guide.translationIntent': 'অনুবাদ উদ্দেশ্য',
    'guide.edit': 'সম্পাদনা করুন',
  },
  zh: {
    'guide.title': '开始吧',
    'guide.poemPlaceholder': '在此粘贴原文...',
    'guide.translationZone': '翻译区域',
    'guide.translationIntent': '翻译意图',
    'guide.edit': '编辑',
  },
  fr: {
    'guide.title': 'Commençons',
    'guide.poemPlaceholder': 'Collez le texte original ici...',
    'guide.normalizeSpacing': 'Normaliser l\'espacement',
    'guide.translationZone': 'Zone de traduction',
    'guide.translationZoneHelper': 'Décrivez brièvement la zone linguistique vers laquelle vous voulez traduire',
    'guide.translationIntent': 'Intention de traduction',
    'guide.translationIntentHelper': 'Décrivez brièvement vos idées sur l\'objectif de votre traduction',
    'guide.saveZone': 'Enregistrer la zone',
    'guide.saveIntent': 'Enregistrer l\'intention',
    'guide.edit': 'Modifier',
    'guide.updateZone': 'Mettre à jour la zone',
    'guide.updateIntent': 'Mettre à jour l\'intention',
    'guide.locked': 'Verrouillé - traduction en cours. Effacez les traductions pour modifier le formatage.',
    'workshop.selectLine': 'Sélectionnez une ligne à traduire',
    'notebook.compare': 'Comparer',
  },
  el: {
    'guide.title': 'Ας ξεκινήσουμε',
    'guide.translationZone': 'Ζώνη μετάφρασης',
    'guide.translationIntent': 'Σκοπός μετάφρασης',
    'guide.edit': 'Επεξεργασία',
  },
  it: {
    'guide.title': 'Iniziamo',
    'guide.translationZone': 'Zona di traduzione',
    'guide.translationIntent': 'Intenzione di traduzione',
    'guide.edit': 'Modifica',
  },
  mr: {
    'guide.title': 'सुरुवात करूया',
    'guide.translationZone': 'अनुवाद क्षेत्र',
    'guide.translationIntent': 'अनुवाद हेतु',
    'guide.edit': 'संपादन करा',
  },
  pt: {
    'guide.title': 'Vamos começar',
    'guide.poemPlaceholder': 'Cole o texto original aqui...',
    'guide.translationZone': 'Zona de tradução',
    'guide.translationIntent': 'Intenção de tradução',
    'guide.edit': 'Editar',
  },
  ta: {
    'guide.title': 'தொடங்குவோம்',
    'guide.translationZone': 'மொழிபெயர்ப்பு மண்டலம்',
    'guide.translationIntent': 'மொழிபெயர்ப்பு நோக்கம்',
    'guide.edit': 'திருத்து',
  },
  te: {
    'guide.title': 'ఆరంభించుకుందాం',
    'guide.translationZone': 'అనువాద జోన్',
    'guide.translationIntent': 'అనువాద ఉద్దేశ్యం',
    'guide.edit': 'సవరించు',
  },
};

export function t(key: string, lang: string = 'en'): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;
}

export function getLangFromCookie(): string {
  if (typeof document === 'undefined') return 'en';
  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('ui-lang='));
  return cookie ? cookie.split('=')[1] : 'en';
}

export function setLangCookie(lang: string) {
  document.cookie = `ui-lang=${lang}; path=/; max-age=31536000`; // 1 year
}

export function getLangConfig(lang: string) {
  return SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0];
}
