import type { CropId, GrowthStage, HealthCategory, LanguageCode, PriorityId } from '../types';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  speechLang: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', speechLang: 'en-US', dir: 'ltr' },
  { code: 'tw', label: 'Twi (Asante)', nativeLabel: 'Twi', speechLang: 'en-GH', dir: 'ltr' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', speechLang: 'fr-FR', dir: 'ltr' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', speechLang: 'es-ES', dir: 'ltr' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', speechLang: 'pt-BR', dir: 'ltr' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili', speechLang: 'sw-KE', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', speechLang: 'hi-IN', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', speechLang: 'ar-SA', dir: 'rtl' },
];

export function getLanguageMeta(code: LanguageCode): LanguageOption {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}

export const CROP_LABELS: Record<CropId, Record<LanguageCode, string>> = {
  maize: {
    en: 'Maize',
    tw: 'Aburo',
    fr: 'Maïs',
    es: 'Maíz',
    pt: 'Milho',
    sw: 'Mahindi',
    hi: 'मक्का',
    ar: 'الذرة',
  },
  cassava: {
    en: 'Cassava',
    tw: 'Bankye',
    fr: 'Manioc',
    es: 'Yuca',
    pt: 'Mandioca',
    sw: 'Mihogo',
    hi: 'कसावा',
    ar: 'الكسافا',
  },
  yam: {
    en: 'Yam',
    tw: 'Bayerɛ',
    fr: 'Igname',
    es: 'Ñame',
    pt: 'Inhame',
    sw: 'Viazi vikuu',
    hi: 'रतालू',
    ar: 'اليام',
  },
  rice: {
    en: 'Rice',
    tw: 'Ɛmo',
    fr: 'Riz',
    es: 'Arroz',
    pt: 'Arroz',
    sw: 'Mchele',
    hi: 'धान / चावल',
    ar: 'الأرز',
  },
  groundnut: {
    en: 'Groundnut',
    tw: 'Nkatee',
    fr: 'Arachide',
    es: 'Maní / Cacahuete',
    pt: 'Amendoim',
    sw: 'Karanga',
    hi: 'मूंगफली',
    ar: 'الفول السوداني',
  },
  cowpea: {
    en: 'Cowpea',
    tw: 'Adua',
    fr: 'Niébé',
    es: 'Caupí / Frijol',
    pt: 'Feijão-caupi',
    sw: 'Kunde',
    hi: 'लोबिया',
    ar: 'اللوبيا',
  },
  soybean: {
    en: 'Soybean',
    tw: 'Soyabin',
    fr: 'Soja',
    es: 'Soja',
    pt: 'Soja',
    sw: 'Soya',
    hi: 'सोयाबीन',
    ar: 'فول الصويا',
  },
  vegetables: {
    en: 'Vegetables',
    tw: 'Ntos / Nnuadewa',
    fr: 'Légumes',
    es: 'Hortalizas',
    pt: 'Hortaliças',
    sw: 'Mboga mboga',
    hi: 'सब्जियाँ',
    ar: 'الخضروات',
  },
  other: {
    en: 'Other',
    tw: 'Afifideɛ foforɔ',
    fr: 'Autre culture',
    es: 'Otro cultivo',
    pt: 'Outra cultura',
    sw: 'Zao lingine',
    hi: 'अन्य फसल',
    ar: 'محصول آخر',
  },
  help_me_decide: {
    en: 'Help me decide',
    tw: 'Boa me ma mensi gyinae',
    fr: 'Aidez-moi à choisir',
    es: 'Ayúdame a decidir',
    pt: 'Ajude-me a escolher',
    sw: 'Nisaidie kuchagua',
    hi: 'निर्णय लेने में मदद करें',
    ar: 'ساعدني في الاختيار',
  },
};

export const PRIORITY_LABELS: Record<PriorityId, Record<LanguageCode, string>> = {
  better_harvest: {
    en: 'Better harvest',
    tw: 'Nnobae pa',
    fr: 'Meilleure récolte',
    es: 'Mejor cosecha',
    pt: 'Melhor colheita',
    sw: 'Mavuno bora',
    hi: 'बेहतर उपज',
    ar: 'محصول أفضل',
  },
  less_water_stress: {
    en: 'Less water stress',
    tw: 'Nsuo ho dadwene sua',
    fr: 'Moins de stress hydrique',
    es: 'Menor estrés hídrico',
    pt: 'Menor estresse hídrico',
    sw: 'Upungufu mdogo wa maji',
    hi: 'कम जल तनाव',
    ar: 'إجهاد مائي أقل',
  },
  lower_costs: {
    en: 'Lower farming costs',
    tw: 'Kua ho ka sua',
    fr: 'Coûts réduits',
    es: 'Menores costos',
    pt: 'Menores custos',
    sw: 'Gharama nafuu',
    hi: 'कम खेती लागत',
    ar: 'تكاليف زراعة أقل',
  },
  improve_soil: {
    en: 'Improve soil condition',
    tw: 'Asase mu ahoɔden',
    fr: 'Améliorer le sol',
    es: 'Mejorar el suelo',
    pt: 'Melhorar o solo',
    sw: 'Kuboresha udongo',
    hi: 'मिट्टी की सेहत सुधारें',
    ar: 'تحسين خصوبة التربة',
  },
  try_another_crop: {
    en: 'Try another crop',
    tw: 'Sɔ afifideɛ foforɔ hwɛ',
    fr: 'Essayer une autre culture',
    es: 'Probar otro cultivo',
    pt: 'Testar outra cultura',
    sw: 'Jaribu zao jingine',
    hi: 'नई फसल आज़माएँ',
    ar: 'تجربة محصول جديد',
  },
};

export const HEALTH_LABELS: Record<
  HealthCategory,
  Record<LanguageCode, string> & { tone: 'good' | 'watch' | 'attention' | 'unknown' }
> = {
  'Good conditions': {
    tone: 'good',
    en: 'Good conditions',
    tw: 'Tebea no ye',
    fr: 'Bonnes conditions',
    es: 'Buenas condiciones',
    pt: 'Boas condições',
    sw: 'Hali nzuri',
    hi: 'अच्छी स्थिति',
    ar: 'ظروف جيدة',
  },
  'Watch carefully': {
    tone: 'watch',
    en: 'Watch carefully',
    tw: 'Hwɛ yiye',
    fr: 'À surveiller',
    es: 'Vigilar de cerca',
    pt: 'Acompanhar de perto',
    sw: 'Fuatilia kwa karibu',
    hi: 'सावधानी से देखें',
    ar: 'مراقبة عن كثب',
  },
  'Needs attention': {
    tone: 'attention',
    en: 'Needs attention',
    tw: 'Ehia ntɛm hwɛ',
    fr: 'Attention requise',
    es: 'Requiere atención',
    pt: 'Requer atenção',
    sw: 'Inahitaji hatua',
    hi: 'तत्काल ध्यान दें',
    ar: 'يتطلب تدخلاً عاجلاً',
  },
  'Not enough information': {
    tone: 'unknown',
    en: 'Not enough information',
    tw: 'Nsɛm no nso mu',
    fr: 'Données insuffisantes',
    es: 'Faltan datos',
    pt: 'Dados insuficientes',
    sw: 'Taarifa hazitoshi',
    hi: 'पर्याप्त जानकारी नहीं',
    ar: 'المعلومات غير كافية',
  },
};

export const GROWTH_STAGE_LABELS: Record<GrowthStage, Record<LanguageCode, string>> = {
  'Land Prep': {
    en: 'Land Prep',
    tw: 'Asase Siesie',
    fr: 'Préparation',
    es: 'Preparación',
    pt: 'Preparo',
    sw: 'Maandalizi',
    hi: 'भूमि तैयारी',
    ar: 'تجهيز الأرض',
  },
  Planted: {
    en: 'Planted',
    tw: 'Wɔadua',
    fr: 'Semé',
    es: 'Sembrado',
    pt: 'Plantado',
    sw: 'Imepandwa',
    hi: 'बुवाई पूर्ण',
    ar: 'تمت الزراعة',
  },
  Vegetative: {
    en: 'Growing',
    tw: 'Ɛrenyini',
    fr: 'Croissance',
    es: 'Crecimiento',
    pt: 'Crescimento',
    sw: 'Inakua',
    hi: 'बढ़वार चरण',
    ar: 'مرحلة النمو',
  },
  Flowering: {
    en: 'Flowering',
    tw: 'Ɛregu nhwiren',
    fr: 'Floraison',
    es: 'Floración',
    pt: 'Floração',
    sw: 'Kutoa maua',
    hi: 'फूल आने पर',
    ar: 'مرحلة الإزهار',
  },
  Harvested: {
    en: 'Harvested',
    tw: 'Wɔatwa',
    fr: 'Récolté',
    es: 'Cosechado',
    pt: 'Colhido',
    sw: 'Imevunwa',
    hi: 'कटाई पूर्ण',
    ar: 'تم الحصاد',
  },
};

export const SOIL_FEEL_LABELS: Record<'Dry' | 'Moist' | 'Wet' | 'Waterlogged', Record<LanguageCode, string>> = {
  Dry: { en: 'Dry', tw: 'Awo', fr: 'Sec', es: 'Seco', pt: 'Seco', sw: 'Kavu', hi: 'सूखी', ar: 'جافة' },
  Moist: { en: 'Moist', tw: 'Fɔ kakra', fr: 'Humide', es: 'Húmedo', pt: 'Úmido', sw: 'Unyevu', hi: 'नम', ar: 'رطبة' },
  Wet: { en: 'Wet', tw: 'Fɔ pii', fr: 'Mouillé', es: 'Mojado', pt: 'Molhado', sw: 'Maji mengi', hi: 'गीली', ar: 'مبللة' },
  Waterlogged: {
    en: 'Waterlogged',
    tw: 'Nsuo gyina mu',
    fr: 'Inondé',
    es: 'Encharcado',
    pt: 'Encharcado',
    sw: 'Imefurika',
    hi: 'जलभराव',
    ar: 'مغمورة بالماء',
  },
};

export const CROP_CONDITION_LABELS: Record<'Thriving' | 'Normal' | 'Stressed', Record<LanguageCode, string>> = {
  Thriving: {
    en: 'Thriving',
    tw: 'Ɛnyini yiye',
    fr: 'Vigoureux',
    es: 'Vigoroso',
    pt: 'Vigoroso',
    sw: 'Inastawi',
    hi: 'बेहतरीन',
    ar: 'نمو ممتاز',
  },
  Normal: { en: 'Normal', tw: 'Ɛyɛ kama', fr: 'Normal', es: 'Normal', pt: 'Normal', sw: 'Kawaida', hi: 'सामान्य', ar: 'طبيعي' },
  Stressed: {
    en: 'Stressed',
    tw: 'Ɛbrɛ / Ɛhia mmoa',
    fr: 'Stressé',
    es: 'Estresado',
    pt: 'Estressado',
    sw: 'Ina msongo',
    hi: 'तनावग्रस्त',
    ar: 'تحت إجهاد',
  },
};

export const RISK_LEVEL_LABELS: Record<'Low' | 'Moderate' | 'Elevated', Record<LanguageCode, string>> = {
  Low: {
    en: 'Low Risk',
    tw: 'Asiane sua',
    fr: 'Risque faible',
    es: 'Riesgo bajo',
    pt: 'Risco baixo',
    sw: 'Hatari ndogo',
    hi: 'कम जोखिम',
    ar: 'خطر منخفض',
  },
  Moderate: {
    en: 'Moderate',
    tw: 'Hwɛ yiye',
    fr: 'Modéré',
    es: 'Moderado',
    pt: 'Moderado',
    sw: 'Wastani',
    hi: 'मध्यम',
    ar: 'متوسط',
  },
  Elevated: {
    en: 'Elevated Alert',
    tw: 'Kɔkɔbɔ Kɛse',
    fr: 'Alerte élevée',
    es: 'Alerta elevada',
    pt: 'Alerta elevado',
    sw: 'Tahadhari kubwa',
    hi: 'उच्च चेतावनी',
    ar: 'تنبيه مرتفع',
  },
};

export function getGreeting(lang: LanguageCode): string {
  const hour = new Date().getHours();
  const map: Record<LanguageCode, [string, string, string]> = {
    en: ['Good morning, Farmer', 'Good afternoon, Farmer', 'Good evening, Farmer'],
    tw: ['Maakye, Okuafoɔ', 'Maaha, Okuafoɔ', 'Maadwo, Okuafoɔ'],
    fr: ['Bonjour, Agriculteur', 'Bon après-midi, Agriculteur', 'Bonsoir, Agriculteur'],
    es: ['Buenos días, Agricultor', 'Buenas tardes, Agricultor', 'Buenas noches, Agricultor'],
    pt: ['Bom dia, Agricultor', 'Boa tarde, Agricultor', 'Boa noite, Agricultor'],
    sw: ['Habari za asubuhi, Mkulima', 'Habari za mchana, Mkulima', 'Habari za jioni, Mkulima'],
    hi: ['सुप्रभात, किसान भाई', 'नमस्कार, किसान भाई', 'शुभ संध्या, किसान भाई'],
    ar: ['صباح الخير أيها المزارع', 'مساء الخير أيها المزارع', 'طاب مساؤك أيها المزارع'],
  };
  const trio = map[lang] ?? map.en;
  if (hour < 12) return trio[0];
  if (hour < 17) return trio[1];
  return trio[2];
}

export interface UIPhraseSet {
  brandTagline: string;
  farmerView: string;
  cropRotationNav: string;
  expertView: string;
  askAlpha: string;
  offlineNotice: string;
  lastUpdated: string;
  listenBtn: string;
  replayBtn: string;
  stopBtn: string;
  letsFindFarm: string;
  findFarmExplain: string;
  allowLocation: string;
  enterManual: string;
  areYouAtFarm: string;
  yesAtFarm: string;
  noElsewhere: string;
  howBig: string;
  lastSeason: string;
  growNext: string;
  whatMatters: string;
  skipStep: string;
  continueBtn: string;
  backBtn: string;
  // Focused Farmer Guide 4 Pillars
  whatsHappeningTitle: string;
  whatsHappeningSubtitle: string;
  problemsTitle: string;
  problemsSubtitle: string;
  solutionsTitle: string;
  solutionsSubtitle: string;
  liveUpdatesTitle: string;
  liveUpdatesSubtitle: string;
  // Crop Rotation Page
  rotationPageTitle: string;
  rotationPageSubtitle: string;
  whatToPlantTitle: string;
  whenToPlantTitle: string;
  plantingCalendarTitle: string;
  rotationSequenceTitle: string;
  startNextSeasonBtn: string;
  // Voice Input Guide
  voiceGuideOn: string;
  voiceGuideOff: string;
  voiceGuideSpeakHint: string;
  voiceGuideDictate: string;
  voiceGuideListening: string;
}

export const UI_COPY: Record<LanguageCode, UIPhraseSet> = {
  en: {
    brandTagline: 'Smarter Farming. Stronger Futures.',
    farmerView: 'Farmer Guide',
    cropRotationNav: 'Crop Rotation',
    expertView: 'Technical View',
    askAlpha: 'Ask Alpha',
    offlineNotice: 'Offline — showing saved farm guidance',
    lastUpdated: 'Updated',
    listenBtn: 'Listen',
    replayBtn: 'Replay',
    stopBtn: 'Stop',
    letsFindFarm: "Let's find your farm!",
    findFarmExplain:
      'Farmova connects your farm anywhere in the world to NASA satellite weather, soil moisture predictions, disaster alerts, and crop rotation guidance.',
    allowLocation: 'Allow Location Access',
    enterManual: 'Search or Mark Any Location',
    areYouAtFarm: 'Are you at your farm right now?',
    yesAtFarm: 'Yes, this is my farm',
    noElsewhere: 'No, my farm is somewhere else',
    howBig: 'How big is your farm?',
    lastSeason: 'What did you grow here last season?',
    growNext: 'What would you like to grow next?',
    whatMatters: 'What matters most to you?',
    skipStep: 'Skip this step',
    continueBtn: 'Continue',
    backBtn: 'Back',
    whatsHappeningTitle: "1. What's Happening on Your Farm",
    whatsHappeningSubtitle: 'Current field condition, growth stage, and 30-day satellite summary',
    problemsTitle: '2. Problems & Risks Detected',
    problemsSubtitle: 'Drought, flood, heat stress, or nearby hazards affecting your plot',
    solutionsTitle: '3. Recommended Solutions',
    solutionsSubtitle: 'Immediate practical actions grounded in your farm data',
    liveUpdatesTitle: '4. Live Updates on the Farm',
    liveUpdatesSubtitle: 'Real-time weather forecast, satellite imagery, and field check-in logs',
    rotationPageTitle: 'Crop Rotation Planner',
    rotationPageSubtitle: 'Decide WHAT to plant next and WHEN to sow using NASA 20-year climatology and soil wetness',
    whatToPlantTitle: 'What to Plant Next',
    whenToPlantTitle: 'When to Plant Next',
    plantingCalendarTitle: '12-Month NASA Climatology Planting Window',
    rotationSequenceTitle: '3-Season Crop Rotation Plan',
    startNextSeasonBtn: 'Start Season With This Crop',
    voiceGuideOn: 'Voice Input Coach: On',
    voiceGuideOff: 'Voice Input Coach: Off',
    voiceGuideSpeakHint: 'Hear how to fill',
    voiceGuideDictate: 'Speak to fill',
    voiceGuideListening: 'Listening...',
  },
  tw: {
    brandTagline: 'Kuayɛ Pa. Daakye Pa.',
    farmerView: 'Okuafoɔ Kyerɛ',
    cropRotationNav: 'Afifideɛ Nsesaeɛ',
    expertView: 'Nimdeɛbea',
    askAlpha: 'Bisa Alpha',
    offlineNotice: 'Intanɛt nni hɔ — worehwɛ nsɛm a yɛakora',
    lastUpdated: 'Nsesaeɛ',
    listenBtn: 'Tie',
    replayBtn: 'Tie Bio',
    stopBtn: 'Gyae',
    letsFindFarm: 'Ma yɛnhwehwɛ w’afuw no!',
    findFarmExplain:
      'Farmova de baabi biara a w’afuw wɔ wɔ wiase nyinaa bata NASA wiem, asase mu fɔ nkɔmhyɛ, ne afifideɛ nsesaeɛ ho.',
    allowLocation: 'Ma GPS kwan',
    enterManual: 'Hwehwɛ anaa kyerɛ w’afuw',
    areYouAtFarm: 'Wowɔ w’afuw no so seesei anaa?',
    yesAtFarm: 'Aane, mewɔ m’afuw so',
    noElsewhere: 'Daabi, m’afuw wɔ baabi foforɔ',
    howBig: 'W’afuw no kɛse te sɛn?',
    lastSeason: 'Afe a etwaam no, dɛn na wuduaa wɔ ha?',
    growNext: 'Dɛn na wopɛ sɛ wudua akyiri yi?',
    whatMatters: 'Dɛn na ɛho hia wo paa?',
    skipStep: 'Tra saa asɛmmisa yi',
    continueBtn: 'Toa so',
    backBtn: 'San akyi',
    whatsHappeningTitle: '1. Deɛ Ɛrekɔ So Wɔ W’afuw So',
    whatsHappeningSubtitle: 'W’afuw tebea, nnua nkɔsoɔ, ne NASA nna 30 nsuo ne hye',
    problemsTitle: '2. Ɔhaw Ne Asiane A Yɛahu',
    problemsSubtitle: 'Ɔpɛ, nsuyiri, owia a ano yɛ den, ne kɔkɔbɔ foforɔ',
    solutionsTitle: '3. Mmoa Ne Ano Aduru',
    solutionsSubtitle: 'Nneɛma a wobɛtumi ayɛ ntɛm de abɔ w’afuw ho ban',
    liveUpdatesTitle: '4. Afuw Ho Nsɛm Foforɔ (Live)',
    liveUpdatesSubtitle: 'Wiem nkɔmhyɛ, NASA mfonini, ne da biara afuw mu hwɛ',
    rotationPageTitle: 'Afifideɛ Nsesaeɛ Nhyehyɛeɛ',
    rotationPageSubtitle: 'Hu AFIFIDEƐ a ɛsɛ sɛ wudua ne BERƐ a ɛfata ma w’afuw',
    whatToPlantTitle: 'Afifideɛ A Ɛsɛ Sɛ Wudua',
    whenToPlantTitle: 'Berɛ A Ɛsɛ Sɛ Wudua',
    plantingCalendarTitle: 'Bosome 12 NASA Nsuo Ne Dua Berɛ',
    rotationSequenceTitle: 'Afe Mmiɛnsa Afifideɛ Nsesaeɛ',
    startNextSeasonBtn: 'Hyɛ Afe Foforɔ Ase',
    voiceGuideOn: 'Nne Kyerɛkyerɛ: Bɔ so',
    voiceGuideOff: 'Nne Kyerɛkyerɛ: Adum',
    voiceGuideSpeakHint: 'Tie akwankyerɛ',
    voiceGuideDictate: 'Kasa ma ɛnkyerɛw',
    voiceGuideListening: 'Ɛretie...',
  },
  fr: {
    brandTagline: 'Agriculture Intelligente. Avenir Solide.',
    farmerView: 'Guide Fermier',
    cropRotationNav: 'Rotation Cultures',
    expertView: 'Vue Technique',
    askAlpha: 'Demander à Alpha',
    offlineNotice: 'Hors ligne — conseils enregistrés affichés',
    lastUpdated: 'Mis à jour',
    listenBtn: 'Écouter',
    replayBtn: 'Réécouter',
    stopBtn: 'Arrêter',
    letsFindFarm: 'Localisons votre parcelle !',
    findFarmExplain:
      'Farmova relie votre champ partout dans le monde aux données météo NASA, à la prévision d’humidité du sol et à la rotation des cultures.',
    allowLocation: 'Autoriser la localisation GPS',
    enterManual: 'Chercher ou marquer un lieu',
    areYouAtFarm: 'Êtes-vous sur votre parcelle en ce moment ?',
    yesAtFarm: 'Oui, c’est ma parcelle',
    noElsewhere: 'Non, mon champ est ailleurs',
    howBig: 'Quelle est la taille de votre ferme ?',
    lastSeason: 'Qu’avez-vous cultivé la saison dernière ?',
    growNext: 'Que souhaitez-vous planter ensuite ?',
    whatMatters: 'Qu’est-ce qui compte le plus pour vous ?',
    skipStep: 'Passer cette étape',
    continueBtn: 'Continuer',
    backBtn: 'Retour',
    whatsHappeningTitle: '1. Situation Actuelle du Champ',
    whatsHappeningSubtitle: 'État général, stade de croissance et bilan NASA 30 jours',
    problemsTitle: '2. Problèmes et Risques Détectés',
    problemsSubtitle: 'Sécheresse, inondation, chaleur excessive et alertes régionales',
    solutionsTitle: '3. Solutions Recommandées',
    solutionsSubtitle: 'Actions pratiques immédiates basées sur vos relevés',
    liveUpdatesTitle: '4. Mises à Jour en Direct',
    liveUpdatesSubtitle: 'Météo Meteomatics en direct, imagerie satellite et suivi de terrain',
    rotationPageTitle: 'Planificateur de Rotation des Cultures',
    rotationPageSubtitle: 'Sachez QUOI planter ensuite et QUAND semer selon la climatologie NASA 20 ans',
    whatToPlantTitle: 'Quelle Culture Planter Ensuite',
    whenToPlantTitle: 'Quand Planter',
    plantingCalendarTitle: 'Calendrier de Semis NASA sur 12 Mois',
    rotationSequenceTitle: 'Séquence de Rotation sur 3 Saisons',
    startNextSeasonBtn: 'Démarrer la Saison avec cette Culture',
    voiceGuideOn: 'Assistant Vocal Champs : Activé',
    voiceGuideOff: 'Assistant Vocal Champs : Désactivé',
    voiceGuideSpeakHint: 'Écouter l’aide',
    voiceGuideDictate: 'Dicter',
    voiceGuideListening: 'Écoute...',
  },
  es: {
    brandTagline: 'Agricultura Inteligente. Futuro Fuerte.',
    farmerView: 'Guía Agrícola',
    cropRotationNav: 'Rotación Cultivos',
    expertView: 'Vista Técnica',
    askAlpha: 'Preguntar a Alpha',
    offlineNotice: 'Sin conexión — mostrando guía guardada',
    lastUpdated: 'Actualizado',
    listenBtn: 'Escuchar',
    replayBtn: 'Repetir',
    stopBtn: 'Detener',
    letsFindFarm: '¡Encontremos tu finca!',
    findFarmExplain:
      'Farmova conecta tu terreno en cualquier lugar del mundo con clima satelital NASA, pronóstico de humedad del suelo y rotación de cultivos.',
    allowLocation: 'Permitir ubicación GPS',
    enterManual: 'Buscar o marcar ubicación',
    areYouAtFarm: '¿Estás en tu finca en este momento?',
    yesAtFarm: 'Sí, esta es mi finca',
    noElsewhere: 'No, mi finca está en otro lugar',
    howBig: '¿Qué tamaño tiene tu finca?',
    lastSeason: '¿Qué cultivaste aquí la temporada pasada?',
    growNext: '¿Qué te gustaría sembrar después?',
    whatMatters: '¿Qué es lo más importante para ti?',
    skipStep: 'Omitir este paso',
    continueBtn: 'Continuar',
    backBtn: 'Atrás',
    whatsHappeningTitle: '1. Qué Está Pasando en Tu Finca',
    whatsHappeningSubtitle: 'Estado del cultivo, etapa actual y resumen satelital de 30 días',
    problemsTitle: '2. Problemas y Riesgos Detectados',
    problemsSubtitle: 'Sequía, exceso de agua, calor extremo y alertas cercanas',
    solutionsTitle: '3. Soluciones Recomendadas',
    solutionsSubtitle: 'Acciones prácticas inmediatas respaldadas por datos NASA',
    liveUpdatesTitle: '4. Actualizaciones en Vivo',
    liveUpdatesSubtitle: 'Pronóstico Meteomatics en vivo, satélite y registros de campo',
    rotationPageTitle: 'Planificador de Rotación de Cultivos',
    rotationPageSubtitle: 'Descubre QUÉ sembrar y CUÁNDO plantar según climatología NASA de 20 años',
    whatToPlantTitle: 'Qué Cultivar Después',
    whenToPlantTitle: 'Cuándo Sembrar',
    plantingCalendarTitle: 'Calendario Climático NASA de 12 Meses',
    rotationSequenceTitle: 'Plan de Rotación de 3 Temporadas',
    startNextSeasonBtn: 'Iniciar Temporada con Este Cultivo',
    voiceGuideOn: 'Guía de Voz en Campos: Activa',
    voiceGuideOff: 'Guía de Voz en Campos: Apagada',
    voiceGuideSpeakHint: 'Oír ayuda',
    voiceGuideDictate: 'Dictar',
    voiceGuideListening: 'Escuchando...',
  },
  pt: {
    brandTagline: 'Agricultura Inteligente. Futuro Forte.',
    farmerView: 'Guia Agrícola',
    cropRotationNav: 'Rotação Culturas',
    expertView: 'Visão Técnica',
    askAlpha: 'Perguntar ao Alpha',
    offlineNotice: 'Offline — exibindo orientação salva',
    lastUpdated: 'Atualizado',
    listenBtn: 'Ouvir',
    replayBtn: 'Ouvir de novo',
    stopBtn: 'Parar',
    letsFindFarm: 'Vamos localizar sua fazenda!',
    findFarmExplain:
      'Farmova conecta sua propriedade no mundo todo a satélites NASA, previsão de umidade do solo e plano de rotação de culturas.',
    allowLocation: 'Permitir acesso ao GPS',
    enterManual: 'Buscar ou marcar no mapa',
    areYouAtFarm: 'Você está na sua fazenda agora?',
    yesAtFarm: 'Sim, esta é minha fazenda',
    noElsewhere: 'Não, minha fazenda fica em outro lugar',
    howBig: 'Qual é o tamanho da sua fazenda?',
    lastSeason: 'O que você plantou aqui na última safra?',
    growNext: 'O que gostaria de plantar na próxima?',
    whatMatters: 'O que é mais importante para você?',
    skipStep: 'Pular esta etapa',
    continueBtn: 'Continuar',
    backBtn: 'Voltar',
    whatsHappeningTitle: '1. O Que Está Acontecendo na Fazenda',
    whatsHappeningSubtitle: 'Saúde da lavoura, estágio atual e resumo de 30 dias da NASA',
    problemsTitle: '2. Problemas e Riscos Detectados',
    problemsSubtitle: 'Seca, excesso de chuva, ondas de calor e alertas próximos',
    solutionsTitle: '3. Soluções Recomendadas',
    solutionsSubtitle: 'Medidas práticas imediatas baseadas nos dados da fazenda',
    liveUpdatesTitle: '4. Atualizações ao Vivo',
    liveUpdatesSubtitle: 'Previsão Meteomatics ao vivo, mapas de satélite e registros de campo',
    rotationPageTitle: 'Planejador de Rotação de Culturas',
    rotationPageSubtitle: 'Saiba O QUE plantar e QUANDO semear usando climatologia NASA de 20 anos',
    whatToPlantTitle: 'O Que Plantar Depois',
    whenToPlantTitle: 'Quando Plantar',
    plantingCalendarTitle: 'Calendário NASA de 12 Meses para Plantio',
    rotationSequenceTitle: 'Sequência de Rotação em 3 Safras',
    startNextSeasonBtn: 'Iniciar Safra com Esta Cultura',
    voiceGuideOn: 'Guia de Voz nos Campos: Ligado',
    voiceGuideOff: 'Guia de Voz nos Campos: Desligado',
    voiceGuideSpeakHint: 'Ouvir instrução',
    voiceGuideDictate: 'Falar',
    voiceGuideListening: 'Ouvindo...',
  },
  sw: {
    brandTagline: 'Kilimo Bora. Kesho Imara.',
    farmerView: 'Mwongozo wa Mkulima',
    cropRotationNav: 'Mzunguko wa Mazao',
    expertView: 'Utaalamu',
    askAlpha: 'Uliza Alpha',
    offlineNotice: 'Huna mtandao — inaonyesha mwongozo uliohifadhiwa',
    lastUpdated: 'Imesasishwa',
    listenBtn: 'Sikiliza',
    replayBtn: 'Rudia',
    stopBtn: 'Simamisha',
    letsFindFarm: 'Tupate eneo la shamba lako!',
    findFarmExplain:
      'Farmova inaunganisha shamba lako popote duniani na hali ya hewa ya satelaiti za NASA, utabiri wa unyevu wa udongo, na mpango wa kubadilisha mazao.',
    allowLocation: 'Ruhusu Mahali (GPS)',
    enterManual: 'Tafuta au Weka Alama',
    areYouAtFarm: 'Je, uko shambani kwako sasa hivi?',
    yesAtFarm: 'Ndiyo, hili ni shamba langu',
    noElsewhere: 'Hapana, shamba langu liko pengine',
    howBig: 'Shamba lako lina ukubwa gani?',
    lastSeason: 'Ulipanda nini hapa msimu uliopita?',
    growNext: 'Ungependa kupanda nini msimu ujao?',
    whatMatters: 'Nini ni muhimu zaidi kwako?',
    skipStep: 'Ruka hatua hii',
    continueBtn: 'Endelea',
    backBtn: 'Rudi',
    whatsHappeningTitle: '1. Kinachoendelea Shambani Sasa',
    whatsHappeningSubtitle: 'Hali ya shamba, hatua ya ukuaji, na taarifa za NASA za siku 30',
    problemsTitle: '2. Matatizo na Hatari Zilizogunduliwa',
    problemsSubtitle: 'Ukame, mafuriko, joto kali, na tahadhari za karibu',
    solutionsTitle: '3. Suluhisho na Hatua za Haraka',
    solutionsSubtitle: 'Hatua za vitendo zinazolingana na hali halisi ya shamba',
    liveUpdatesTitle: '4. Taarifa za Moja kwa Moja Shambani',
    liveUpdatesSubtitle: 'Hali ya hewa ya sasa (Meteomatics), picha za satelaiti, na kumbukumbu za shamba',
    rotationPageTitle: 'Mpango wa Mzunguko wa Mazao',
    rotationPageSubtitle: 'Jua ZAO gani la kupanda na WAKATI gani sahihi wa kupanda kwa kutumia data ya NASA',
    whatToPlantTitle: 'Zao la Kupanda Kufuata',
    whenToPlantTitle: 'Wakati Sahihi wa Kupanda',
    plantingCalendarTitle: 'Kalenda ya Miezi 12 ya NASA ya Kupanda',
    rotationSequenceTitle: 'Mpango wa Misimu 3 ya Mzunguko',
    startNextSeasonBtn: 'Anza Msimu na Zao Hili',
    voiceGuideOn: 'Msaidizi wa Sauti: Amewashwa',
    voiceGuideOff: 'Msaidizi wa Sauti: Amezimwa',
    voiceGuideSpeakHint: 'Sikiliza maelezo',
    voiceGuideDictate: 'Sema kuandika',
    voiceGuideListening: 'Inasikiliza...',
  },
  hi: {
    brandTagline: 'स्मार्ट खेती। मज़बूत भविष्य।',
    farmerView: 'किसान मार्गदर्शिका',
    cropRotationNav: 'फसल चक्र',
    expertView: 'तकनीकी डेटा',
    askAlpha: 'अल्फा से पूछें',
    offlineNotice: 'ऑफ़लाइन — सहेजी गई कृषि सलाह दिखाई जा रही है',
    lastUpdated: 'अपडेट किया गया',
    listenBtn: 'सुनें',
    replayBtn: 'दोबारा सुनें',
    stopBtn: 'रोकें',
    letsFindFarm: 'आइए आपका खेत खोजें!',
    findFarmExplain:
      'फार्मॉवा दुनिया भर में आपके खेत को नासा उपग्रह मौसम, मिट्टी की नमी के पूर्वानुमान, आपदा अलर्ट और फसल चक्र सलाह से जोड़ता है।',
    allowLocation: 'GPS लोकेशन की अनुमति दें',
    enterManual: 'स्थान खोजें या मानचित्र पर चुनें',
    areYouAtFarm: 'क्या आप अभी अपने खेत पर हैं?',
    yesAtFarm: 'हाँ, यही मेरा खेत है',
    noElsewhere: 'नहीं, मेरा खेत कहीं और है',
    howBig: 'आपका खेत कितना बड़ा है?',
    lastSeason: 'पिछले सीज़न में आपने यहाँ क्या बोया था?',
    growNext: 'अगले सीज़न में आप क्या उगाना चाहेंगे?',
    whatMatters: 'आपके लिए सबसे ज़रूरी क्या है?',
    skipStep: 'यह चरण छोड़ें',
    continueBtn: 'आगे बढ़ें',
    backBtn: 'पीछे',
    whatsHappeningTitle: '1. खेत में अभी क्या हो रहा है',
    whatsHappeningSubtitle: 'खेत की स्थिति, फसल चरण और 30-दिन का नासा मौसम सारांश',
    problemsTitle: '2. समस्याएँ और पहचाने गए जोखिम',
    problemsSubtitle: 'सूखा, जलभराव, लू/गर्मी और आसपास के प्राकृतिक खतरे',
    solutionsTitle: '3. समाधान और तुरंत करने योग्य उपाय',
    solutionsSubtitle: 'आपके खेत के डेटा पर आधारित व्यावहारिक कृषि समाधान',
    liveUpdatesTitle: '4. खेत के लाइव अपडेट',
    liveUpdatesSubtitle: 'लाइव मौसम पूर्वानुमान, सैटेलाइट दृश्य और दैनिक खेत जांच लॉग',
    rotationPageTitle: 'फसल चक्र योजना (Crop Rotation)',
    rotationPageSubtitle: 'नासा के 20-वर्षीय जलवायु डेटा से जानें आगे कौन सी फसल बोएँ और कब बोएँ',
    whatToPlantTitle: 'आगे कौन सी फसल बोएँ',
    whenToPlantTitle: 'बुवाई का सही समय कब है',
    plantingCalendarTitle: '12-महीने का नासा बुवाई कैलेंडर',
    rotationSequenceTitle: '3-सीज़न फसल चक्र क्रम',
    startNextSeasonBtn: 'इस फसल के साथ नया सीज़न शुरू करें',
    voiceGuideOn: 'बोलकर सहायता: चालू',
    voiceGuideOff: 'बोलकर सहायता: बंद',
    voiceGuideSpeakHint: 'निर्देश सुनें',
    voiceGuideDictate: 'बोलकर लिखें',
    voiceGuideListening: 'सुन रहे हैं...',
  },
  ar: {
    brandTagline: 'زراعة أذكى. مستقبل أقوى.',
    farmerView: 'دليل المزارع',
    cropRotationNav: 'الدورة الزراعية',
    expertView: 'العرض التقني',
    askAlpha: 'اسأل ألفا',
    offlineNotice: 'غير متصل — عرض الإرشادات المحفوظة',
    lastUpdated: 'آخر تحديث',
    listenBtn: 'استمع',
    replayBtn: 'إعادة',
    stopBtn: 'إيقاف',
    letsFindFarm: 'لنحدد موقع مزرعتك!',
    findFarmExplain:
      'يربط فارموفا مزرعتك في أي مكان بالعالم ببيانات ناسا للطقس وتوقعات رطوبة التربة وتنبيهات المخاطر وخطة الدورة الزراعية.',
    allowLocation: 'السماح بالوصول إلى GPS',
    enterManual: 'ابحث أو حدد الموقع على الخريطة',
    areYouAtFarm: 'هل أنت في مزرعتك الآن؟',
    yesAtFarm: 'نعم، هذه مزرعتي',
    noElsewhere: 'لا، مزرعتي في مكان آخر',
    howBig: 'ما هي مساحة مزرعتك؟',
    lastSeason: 'ماذا زرعت هنا في الموسم الماضي؟',
    growNext: 'ماذا تود أن تزرع بعد ذلك؟',
    whatMatters: 'ما هو الأهم بالنسبة لك؟',
    skipStep: 'تخطي هذه الخطوة',
    continueBtn: 'متابعة',
    backBtn: 'رجوع',
    whatsHappeningTitle: '1. ماذا يحدث في مزرعتك الآن',
    whatsHappeningSubtitle: 'حالة الحقل الحالية، مرحلة النمو، وملخص أقمار ناسا لـ 30 يوماً',
    problemsTitle: '2. المشاكل والمخاطر المرصودة',
    problemsSubtitle: 'مخاطر الجفاف، الغمر، الإجهاد الحراري، والتنبيهات القريبة',
    solutionsTitle: '3. الحلول والإجراءات الموصى بها',
    solutionsSubtitle: 'خطوات عملية فورية مبنية على بيانات مزرعتك',
    liveUpdatesTitle: '4. التحديثات المباشرة من المزرعة',
    liveUpdatesSubtitle: 'توقعات الطقس المباشرة، صور الأقمار الصناعية، وسجل المتابعة الميدانية',
    rotationPageTitle: 'مخطط الدورة الزراعية',
    rotationPageSubtitle: 'اعرف ماذا تزرع ومتى تزرع المحصول القادم اعتماداً على بيانات ناسا لـ 20 عاماً',
    whatToPlantTitle: 'ماذا تزرع بعد ذلك',
    whenToPlantTitle: 'متى تزرع المحصول القادم',
    plantingCalendarTitle: 'تقويم الزراعة المناخي من ناسا (12 شهراً)',
    rotationSequenceTitle: 'خطة الدورة الزراعية لـ 3 مواسم',
    startNextSeasonBtn: 'بدء الموسم بهذا المحصول',
    voiceGuideOn: 'المرشد الصوتي للحقول: مفعل',
    voiceGuideOff: 'المرشد الصوتي للحقول: متوقف',
    voiceGuideSpeakHint: 'اسمع الإرشاد',
    voiceGuideDictate: 'تحدث للكتابة',
    voiceGuideListening: 'جاري الاستماع...',
  },
};

export type FieldGuideKey =
  | 'location_search'
  | 'latitude'
  | 'longitude'
  | 'farm_name'
  | 'community'
  | 'country'
  | 'checkin_note'
  | 'season_label'
  | 'planting_date'
  | 'rotation_note'
  | 'alpha_question';

export interface FieldVoiceGuideEntry {
  title: string;
  instruction: string;
  example: string;
}

export const FIELD_VOICE_GUIDES: Record<FieldGuideKey, Record<LanguageCode, FieldVoiceGuideEntry>> = {
  location_search: {
    en: {
      title: 'Search Region or Town',
      instruction: 'Type the name of your nearest town, district, or country to move the map to your farming area.',
      example: 'Example: Ejura, Nakuru, Pune, or Iowa',
    },
    tw: {
      title: 'Hwehwɛ Kuro Anaa Ɔman',
      instruction: 'Kyerɛw kuro a ɛbɛn w’afuw anaa wo man din wɔ ha na asase mfonini no akɔ hɔ.',
      example: 'Nhwɛsoɔ: Ejura, Tamale, Nakuru, anaa Ghana',
    },
    fr: {
      title: 'Rechercher une ville ou région',
      instruction: 'Tapez le nom de votre village, ville ou pays le plus proche pour centrer la carte sur votre zone.',
      example: 'Exemple : Ejura, Nakuru, Dakar ou Lyon',
    },
    es: {
      title: 'Buscar ciudad o región',
      instruction: 'Escriba el nombre de su pueblo, municipio o país más cercano para ubicar su finca en el mapa.',
      example: 'Ejemplo: Ejura, Nakuru, Bogotá o Oaxaca',
    },
    pt: {
      title: 'Buscar cidade ou região',
      instruction: 'Digite o nome da sua cidade, município ou país mais próximo para posicionar o mapa na sua região.',
      example: 'Exemplo: Sorriso, Ejura, Nakuru ou Brasil',
    },
    sw: {
      title: 'Tafuta Mji au Eneo',
      instruction: 'Andika jina la mji, wilaya, au nchi iliyo karibu na shamba lako ili kusogeza ramani.',
      example: 'Mfano: Nakuru, Arusha, Ejura au Kenya',
    },
    hi: {
      title: 'शहर या क्षेत्र खोजें',
      instruction: 'मानचित्र को अपने खेती क्षेत्र पर ले जाने के लिए अपने पास के गाँव, जिले या देश का नाम लिखें।',
      example: 'उदाहरण: पुणे, करनाल, नकुरु या भारत',
    },
    ar: {
      title: 'ابحث عن المدينة أو المنطقة',
      instruction: 'اكتب اسم أقرب بلدة أو منطقة أو دولة لنقل الخريطة إلى موقع مزرعتك.',
      example: 'مثال: الدلتا، الخرطوم، نكورو، أو إجورا',
    },
  },
  latitude: {
    en: {
      title: 'Latitude Coordinate',
      instruction: 'Enter your farm latitude number from minus 90 to plus 90 if you have GPS numbers written down.',
      example: 'Example: 7.3825',
    },
    tw: {
      title: 'Asase Nɔma (Latitude)',
      instruction: 'Kyerɛw w’afuw latitude nɔma fi -90 kɔsi 90 wɔ ha sɛ wowɔ GPS nɔma a.',
      example: 'Nhwɛsoɔ: 7.3825',
    },
    fr: {
      title: 'Latitude GPS',
      instruction: 'Saisissez la latitude de votre champ entre -90 et 90 si vous connaissez vos coordonnées.',
      example: 'Exemple : 7.3825',
    },
    es: {
      title: 'Coordenada de Latitud',
      instruction: 'Escriba la latitud de su finca entre -90 y 90 si tiene los números del GPS.',
      example: 'Ejemplo: 7.3825',
    },
    pt: {
      title: 'Coordenada de Latitude',
      instruction: 'Digite a latitude da sua fazenda entre -90 e 90 se tiver as coordenadas GPS.',
      example: 'Exemplo: -12.5425',
    },
    sw: {
      title: 'Namba ya Latitudo',
      instruction: 'Andika namba ya latitudo ya shamba lako kati ya -90 na 90 ikiwa unayo.',
      example: 'Mfano: -0.3031',
    },
    hi: {
      title: 'अक्षांश (Latitude)',
      instruction: 'यदि आपके पास GPS नंबर है, तो -90 से 90 के बीच अपने खेत का अक्षांश लिखें।',
      example: 'उदाहरण: 18.1506',
    },
    ar: {
      title: 'خط العرض (Latitude)',
      instruction: 'أدخل رقم خط العرض الخاص بمزرعتك بين -90 و 90 إذا كانت لديك إحداثيات GPS.',
      example: 'مثال: 7.3825',
    },
  },
  longitude: {
    en: {
      title: 'Longitude Coordinate',
      instruction: 'Enter your farm longitude number from minus 180 to plus 180 to place the pin accurately.',
      example: 'Example: -1.3602',
    },
    tw: {
      title: 'Asase Nɔma (Longitude)',
      instruction: 'Kyerɛw w’afuw longitude nɔma fi -180 kɔsi 180 wɔ ha.',
      example: 'Nhwɛsoɔ: -1.3602',
    },
    fr: {
      title: 'Longitude GPS',
      instruction: 'Saisissez la longitude entre -180 et 180 pour placer exactement le repère sur la carte.',
      example: 'Exemple : -1.3602',
    },
    es: {
      title: 'Coordenada de Longitud',
      instruction: 'Escriba la longitud de su finca entre -180 y 180 para ubicar el marcador con precisión.',
      example: 'Ejemplo: -1.3602',
    },
    pt: {
      title: 'Coordenada de Longitude',
      instruction: 'Digite a longitude entre -180 e 180 para posicionar o pino com precisão.',
      example: 'Exemplo: -55.7211',
    },
    sw: {
      title: 'Namba ya Longitudo',
      instruction: 'Andika namba ya longitudo ya shamba lako kati ya -180 na 180.',
      example: 'Mfano: 36.0800',
    },
    hi: {
      title: 'देशांतर (Longitude)',
      instruction: 'सटीक स्थान के लिए -180 से 180 के बीच अपने खेत का देशांतर लिखें।',
      example: 'उदाहरण: 74.5772',
    },
    ar: {
      title: 'خط الطول (Longitude)',
      instruction: 'أدخل رقم خط الطول بين -180 و 180 لتحديد موقع مزرعتك بدقة.',
      example: 'مثال: -1.3602',
    },
  },
  farm_name: {
    en: {
      title: 'Farm Name',
      instruction: 'Type a short name you will recognize for this plot, such as North Plot or River Valley Farm.',
      example: 'Example: Valley Maize Plot',
    },
    tw: {
      title: 'W’afuw Din',
      instruction: 'Kyerɛw din tiawa a wode bɛkae saa afuw yi, te sɛ Asubɔnten Ho Afuw.',
      example: 'Nhwɛsoɔ: Asubɔnten Ho Afuw',
    },
    fr: {
      title: 'Nom de la parcelle',
      instruction: 'Saisissez un nom court facile à reconnaître pour votre champ, comme Parcelle Nord.',
      example: 'Exemple : Parcelle de la Vallée',
    },
    es: {
      title: 'Nombre de la finca',
      instruction: 'Escriba un nombre corto que reconozca fácilmente para esta parcela.',
      example: 'Ejemplo: Parcela del Valle',
    },
    pt: {
      title: 'Nome da fazenda',
      instruction: 'Digite um nome curto para identificar este talhão ou fazenda.',
      example: 'Exemplo: Talhão do Vale',
    },
    sw: {
      title: 'Jina la Shamba',
      instruction: 'Andika jina fupi utakalokumbuka kwa shamba hili, kama Shamba la Bonde.',
      example: 'Mfano: Shamba la Bonde',
    },
    hi: {
      title: 'खेत का नाम',
      instruction: 'इस खेत की पहचान के लिए एक छोटा नाम लिखें, जैसे नदी किनारे वाला खेत।',
      example: 'उदाहरण: पूर्वी मक्का खेत',
    },
    ar: {
      title: 'اسم المزرعة',
      instruction: 'اكتب اسماً قصيراً يسهل تذكره لهذه القطعة من الأرض.',
      example: 'مثال: حقل الوادي الشمالي',
    },
  },
  community: {
    en: {
      title: 'Community or Town',
      instruction: 'Type the village, town, or local community nearest to your farm.',
      example: 'Example: Ejura, Nakuru, or Ames',
    },
    tw: {
      title: 'Kuro Anaa Mpɔtam',
      instruction: 'Kyerɛw akuraa anaa kuro a ɛbɛn w’afuw no din wɔ ha.',
      example: 'Nhwɛsoɔ: Ejura anaa Techiman',
    },
    fr: {
      title: 'Commune ou village',
      instruction: 'Tapez le nom du village ou de la commune la plus proche de votre parcelle.',
      example: 'Exemple : Ejura ou Nakuru',
    },
    es: {
      title: 'Comunidad o pueblo',
      instruction: 'Escriba el nombre del pueblo o comunidad más cercana a su finca.',
      example: 'Ejemplo: Ejura o Oaxaca',
    },
    pt: {
      title: 'Comunidade ou cidade',
      instruction: 'Digite o nome da comunidade ou cidade mais próxima da sua fazenda.',
      example: 'Exemplo: Sorriso ou Ejura',
    },
    sw: {
      title: 'Kijiji au Mji',
      instruction: 'Andika jina la kijiji au mji ulio karibu na shamba lako.',
      example: 'Mfano: Nakuru au Eldoret',
    },
    hi: {
      title: 'गाँव या शहर',
      instruction: 'अपने खेत के सबसे नजदीकी गाँव या शहर का नाम लिखें।',
      example: 'उदाहरण: बारामती या करनाल',
    },
    ar: {
      title: 'القرية أو المدينة',
      instruction: 'اكتب اسم القرية أو البلدة الأقرب إلى مزرعتك.',
      example: 'مثال: إجورا أو نكورو',
    },
  },
  country: {
    en: {
      title: 'Country',
      instruction: 'Type the country where your farm is located so regional advisories match your area.',
      example: 'Example: Ghana, Kenya, India, or Brazil',
    },
    tw: {
      title: 'Ɔman',
      instruction: 'Kyerɛw ɔman a w’afuw wɔ mu no din wɔ ha.',
      example: 'Nhwɛsoɔ: Ghana anaa Kenya',
    },
    fr: {
      title: 'Pays',
      instruction: 'Saisissez le pays où se situe votre exploitation agricole.',
      example: 'Exemple : Côte d’Ivoire, Sénégal, France',
    },
    es: {
      title: 'País',
      instruction: 'Escriba el país donde está ubicada su finca.',
      example: 'Ejemplo: México, Colombia, Perú',
    },
    pt: {
      title: 'País',
      instruction: 'Digite o país onde sua propriedade está localizada.',
      example: 'Exemplo: Brasil, Moçambique, Angola',
    },
    sw: {
      title: 'Nchi',
      instruction: 'Andika nchi ambapo shamba lako lipo.',
      example: 'Mfano: Kenya, Tanzania, Uganda',
    },
    hi: {
      title: 'देश',
      instruction: 'उस देश का नाम लिखें जहाँ आपका खेत स्थित है।',
      example: 'उदाहरण: भारत, नेपाल, केन्या',
    },
    ar: {
      title: 'الدولة',
      instruction: 'اكتب اسم الدولة التي تقع فيها مزرعتك.',
      example: 'مثال: مصر، المغرب، السودان',
    },
  },
  checkin_note: {
    en: {
      title: 'Field Observation Note',
      instruction: 'Describe what you see on your farm today: leaf color, weeds, pests, or how wet the soil feels.',
      example: 'Example: Leaves look bright green, cleared weeds on east side',
    },
    tw: {
      title: 'Deɛ Wohunu Wɔ Afuw Mu Nnɛ',
      instruction: 'Kyerɛw deɛ wohunu wɔ w’afuw mu nnɛ: ahaban ahosuo, nwura, mmoawa, anaa fɔ a ɛwɔ asase mu.',
      example: 'Nhwɛsoɔ: Ahaban no yɛ frɔmm, yɛadɔ nwura no',
    },
    fr: {
      title: 'Observation du champ',
      instruction: 'Décrivez ce que vous voyez aujourd’hui : couleur des feuilles, mauvaises herbes ou humidité du sol.',
      example: 'Exemple : Feuilles bien vertes, désherbage terminé à l’est',
    },
    es: {
      title: 'Nota de observación de campo',
      instruction: 'Describa lo que ve hoy en su cultivo: color de hojas, malezas, plagas o humedad de la tierra.',
      example: 'Ejemplo: Hojas verdes sanas, suelo húmedo tras la lluvia',
    },
    pt: {
      title: 'Observação de campo',
      instruction: 'Descreva o que você vê hoje na lavoura: cor das folhas, ervas daninhas ou umidade do solo.',
      example: 'Exemplo: Folhas verdes saudáveis, solo úmido após chuva',
    },
    sw: {
      title: 'Maelezo ya Hali ya Shamba',
      instruction: 'Eleza unachokiona shambani leo: rangi ya majani, magugu, wadudu, au unyevu wa udongo.',
      example: 'Mfano: Majani ni mabichi na yana afya, palizi imefanyika',
    },
    hi: {
      title: 'खेत निरीक्षण नोट',
      instruction: 'आज खेत में जो दिख रहा है वह लिखें: पत्तियों का रंग, खरपतवार, कीट या मिट्टी की नमी।',
      example: 'उदाहरण: पत्तियाँ हरी-भरी हैं, मेड़ के पास की निराई पूरी हुई',
    },
    ar: {
      title: 'ملاحظة المعاينة الميدانية',
      instruction: 'صف ما تراه في مزرعتك اليوم: لون الأوراق، الأعشاب، الآفات، أو رطوبة التربة.',
      example: 'مثال: الأوراق خضراء وصحية والتربة رطبة بعد المطر',
    },
  },
  season_label: {
    en: {
      title: 'Season Label',
      instruction: 'Type a short label for this planting season with the year and crop name so you can track it later.',
      example: 'Example: Main Rains 2026 — Cowpea',
    },
    tw: {
      title: 'Kuayɛ Afe Din',
      instruction: 'Kyerɛw afe ne afifideɛ din bi a wode bɛkae saa dua berɛ yi.',
      example: 'Nhwɛsoɔ: Nsuo Berɛ 2026 — Adua',
    },
    fr: {
      title: 'Nom de la saison',
      instruction: 'Saisissez un nom court avec la saison et la culture pour suivre l’évolution.',
      example: 'Exemple : Saison des pluies 2026 — Niébé',
    },
    es: {
      title: 'Nombre de la temporada',
      instruction: 'Escriba un nombre con el año y cultivo para identificar esta campaña.',
      example: 'Ejemplo: Lluvias 2026 — Frijol Caupí',
    },
    pt: {
      title: 'Nome da safra',
      instruction: 'Digite um rótulo com ano e cultura para acompanhar esta safra.',
      example: 'Exemplo: Safra 2026 — Feijão-caupi',
    },
    sw: {
      title: 'Jina la Msimu',
      instruction: 'Andika jina fupi lenye mwaka na zao ili kufuatilia msimu huu.',
      example: 'Mfano: Masika 2026 — Kunde',
    },
    hi: {
      title: 'सीज़न का नाम',
      instruction: 'इस फसल चक्र को याद रखने के लिए वर्ष और फसल का नाम लिखें।',
      example: 'उदाहरण: खरीफ 2026 — मूंगफली',
    },
    ar: {
      title: 'اسم الموسم الزراعي',
      instruction: 'اكتب اسماً للموسم مع السنة واسم المحصول لمتابعته لاحقاً.',
      example: 'مثال: موسم الأمطار 2026 — اللوبيا',
    },
  },
  planting_date: {
    en: {
      title: 'Planting Date',
      instruction: 'Select or enter the calendar date you planted or plan to plant this crop.',
      example: 'Example: 2026-11-15',
    },
    tw: {
      title: 'Da A Wuduae',
      instruction: 'Yi da a wuduae anaa da a wobɛdua afifideɛ yi wɔ ha.',
      example: 'Nhwɛsoɔ: 2026-11-15',
    },
    fr: {
      title: 'Date de semis',
      instruction: 'Sélectionnez la date à laquelle vous avez semé ou prévoyez de planter cette culture.',
      example: 'Exemple : 2026-11-15',
    },
    es: {
      title: 'Fecha de siembra',
      instruction: 'Elija la fecha en la que sembró o planea sembrar este cultivo.',
      example: 'Ejemplo: 2026-11-15',
    },
    pt: {
      title: 'Data de plantio',
      instruction: 'Escolha a data em que plantou ou pretende plantar esta cultura.',
      example: 'Exemplo: 2026-11-15',
    },
    sw: {
      title: 'Tarehe ya Kupanda',
      instruction: 'Chagua tarehe uliyopanda au unayopanga kupanda zao hili.',
      example: 'Mfano: 2026-11-15',
    },
    hi: {
      title: 'बुवाई की तारीख',
      instruction: 'जिस तारीख को आपने बुवाई की या करने वाले हैं, उसे चुनें।',
      example: 'उदाहरण: 2026-11-15',
    },
    ar: {
      title: 'تاريخ الزراعة',
      instruction: 'اختر التاريخ الذي زرعت فيه أو تخطط لزراعة هذا المحصول فيه.',
      example: 'مثال: 2026-11-15',
    },
  },
  rotation_note: {
    en: {
      title: 'Crop Rotation Plan Note',
      instruction: 'Write any soil prep reminders, seed variety, or spacing plan for your next crop rotation.',
      example: 'Example: Clear maize stalks for mulch and source short-duration cowpea seed',
    },
    tw: {
      title: 'Afifideɛ Nsesaeɛ Nkaeɛ',
      instruction: 'Kyerɛw sɛnea wobɛsiesie asase no anaa aba a wobɛtɔ ama afifideɛ foforɔ no.',
      example: 'Nhwɛsoɔ: Fa aburo ntɛtea kata asase so ansa na woadua adua',
    },
    fr: {
      title: 'Note de planification de rotation',
      instruction: 'Notez vos rappels pour la préparation du sol ou le choix de semences pour la prochaine culture.',
      example: 'Exemple : Laisser les résidus de maïs en paillis avant de semer le niébé',
    },
    es: {
      title: 'Nota del plan de rotación',
      instruction: 'Anote recordatorios de preparación del suelo o variedad de semilla para su próximo cultivo.',
      example: 'Ejemplo: Dejar rastrojo como cobertura y conseguir semilla de ciclo corto',
    },
    pt: {
      title: 'Nota do plano de rotação',
      instruction: 'Anote lembretes de preparo do solo ou variedade de semente para a próxima cultura.',
      example: 'Exemplo: Manter palhada do milho e plantar feijão-caupi precoce',
    },
    sw: {
      title: 'Kumbukumbu ya Mzunguko wa Mazao',
      instruction: 'Andika maandalizi ya udongo au mbegu unazohitaji kabla ya msimu ujao.',
      example: 'Mfano: Acha mabaki ya mahindi kufunika udongo kabla ya kupanda kunde',
    },
    hi: {
      title: 'फसल चक्र तैयारी नोट',
      instruction: 'अगली फसल की तैयारी, बीज किस्म या जुताई से जुड़ी जानकारी यहाँ लिखें।',
      example: 'उदाहरण: मक्का के डंठल मल्च के रूप में रखें और कम अवधि का बीज लें',
    },
    ar: {
      title: 'ملاحظة خطة الدورة الزراعية',
      instruction: 'اكتب تذكيرات تجهيز التربة أو صنف البذور للموسم القادم.',
      example: 'مثال: إبقاء بقايا الذرة كغطاء للتربة وزراعة لوبيا سريعة النضج',
    },
  },
  alpha_question: {
    en: {
      title: 'Ask Alpha Any Farming Question',
      instruction: 'Type or speak a question about your farm weather, soil moisture, problems, or next crop.',
      example: 'Example: Is it safe to plant cowpea this week?',
    },
    tw: {
      title: 'Bisa Alpha Asɛm Biara',
      instruction: 'Kyerɛw anaa kasa bisa asɛm fa nsuo, asase mu fɔ, anaa afifideɛ a ɛsɛ sɛ wudua ho.',
      example: 'Nhwɛsoɔ: Mewɔ nsuo pii seesei anaa mɛtumi adua adua?',
    },
    fr: {
      title: 'Question pour Alpha',
      instruction: 'Tapez ou dictez votre question sur la météo du champ, l’humidité du sol ou la prochaine culture.',
      example: 'Exemple : Est-ce le bon moment pour semer du niébé ?',
    },
    es: {
      title: 'Pregunta para Alpha',
      instruction: 'Escriba o dicte su pregunta sobre el clima, la humedad del suelo o el próximo cultivo.',
      example: 'Ejemplo: ¿Es buen momento para sembrar esta semana?',
    },
    pt: {
      title: 'Pergunte ao Alpha',
      instruction: 'Digite ou fale sua dúvida sobre o clima, umidade do solo ou próxima cultura.',
      example: 'Exemplo: Já posso plantar feijão esta semana?',
    },
    sw: {
      title: 'Uliza Alpha Swali Lolote',
      instruction: 'Andika au sema swali kuhusu hali ya hewa, unyevu wa udongo, au zao la kupanda.',
      example: 'Mfano: Je, ni salama kupanda kunde wiki hii?',
    },
    hi: {
      title: 'अल्फा से सवाल पूछें',
      instruction: 'मौसम, मिट्टी की नमी, समस्या या अगली फसल के बारे में अपना सवाल लिखें या बोलें।',
      example: 'उदाहरण: क्या इस सप्ताह बुवाई करना सुरक्षित है?',
    },
    ar: {
      title: 'اسأل ألفا أي سؤال زراعي',
      instruction: 'اكتب أو تحدث بسؤالك حول طقس المزرعة أو رطوبة التربة أو المحصول القادم.',
      example: 'مثال: هل الوقت مناسب للزراعة هذا الأسبوع؟',
    },
  },
};
