/**
 * types/styling.ts
 *
 * Wspólne typy, allowlisty, sanityzacja, walidacja i deterministyczne reguły budowania zapytań
 * dla modułu stylizacji osobistej AI w Stylistka 2026 (/studio).
 */

export type ClothingCategory =
  | 'dresses'
  | 'tops'
  | 'skirts'
  | 'pants'
  | 'blazers'
  | 'outerwear'
  | 'full_outfit';

export type Occasion =
  | 'daily'
  | 'work'
  | 'date_evening'
  | 'wedding_party'
  | 'business_formal'
  | 'vacation'
  | 'other';

export type StylePreference =
  | 'classic'
  | 'elegant'
  | 'feminine'
  | 'minimalist'
  | 'casual'
  | 'romantic'
  | 'modern'
  | 'bold';

export interface StylingPreferences {
  category: ClothingCategory;
  occasion: Occasion;
  customOccasion?: string;
  styles: StylePreference[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// ALLOWLISTY I MAPY ETYKIET
// ---------------------------------------------------------------------------

export const CLOTHING_CATEGORIES: readonly ClothingCategory[] = [
  'dresses',
  'tops',
  'skirts',
  'pants',
  'blazers',
  'outerwear',
  'full_outfit',
] as const;

export const OCCASIONS: readonly Occasion[] = [
  'daily',
  'work',
  'date_evening',
  'wedding_party',
  'business_formal',
  'vacation',
  'other',
] as const;

export const STYLE_PREFERENCES: readonly StylePreference[] = [
  'classic',
  'elegant',
  'feminine',
  'minimalist',
  'casual',
  'romantic',
  'modern',
  'bold',
] as const;

// Czytelne polskie nazwy kategorii w interfejsie
export const CATEGORY_NAMES: Record<ClothingCategory, string> = {
  dresses: 'Sukienki',
  tops: 'Bluzki i topy',
  skirts: 'Spódnice',
  pants: 'Spodnie',
  blazers: 'Marynarki i żakiety',
  outerwear: 'Płaszcze i kurtki',
  full_outfit: 'Pełna stylizacja',
};

// Czytelne polskie nazwy okazji
export const OCCASION_NAMES: Record<Occasion, string> = {
  daily: 'Na co dzień',
  work: 'Do pracy',
  date_evening: 'Randka lub wieczór',
  wedding_party: 'Wesele lub przyjęcie',
  business_formal: 'Spotkanie biznesowe',
  vacation: 'Wyjazd lub wakacje',
  other: 'Inna okazja',
};

// Czytelne polskie nazwy stylów
export const STYLE_NAMES: Record<StylePreference, string> = {
  classic: 'Klasyczny',
  elegant: 'Elegancki',
  feminine: 'Kobiecy',
  minimalist: 'Minimalistyczny',
  casual: 'Swobodny / Casual',
  romantic: 'Romantyczny',
  modern: 'Nowoczesny',
  bold: 'Wyrazisty',
};

// Słowa kluczowe do wyszukiwarki dla kategorii
export const CATEGORY_SEARCH_TERMS: Record<ClothingCategory, string> = {
  dresses: 'sukienka',
  tops: 'bluzka',
  skirts: 'spódnica',
  pants: 'spodnie',
  blazers: 'marynarka',
  outerwear: 'płaszcz',
  full_outfit: 'komplet stylizacja',
};

// Słowa kluczowe do wyszukiwarki dla okazji
export const OCCASION_SEARCH_TERMS: Record<Occasion, string> = {
  daily: 'casual codzienna',
  work: 'do pracy biurowa',
  date_evening: 'wieczorowa elegancka',
  wedding_party: 'wesele wizytowa',
  business_formal: 'formalna biznesowa',
  vacation: 'letnia wakacyjna',
  other: 'wizytowa', // bezpieczny deterministyczny modyfikator dla 'other'
};

// Słowa kluczowe do wyszukiwarki dla stylu (najwyżej jeden w zapytaniu)
export const STYLE_SEARCH_TERMS: Record<StylePreference, string> = {
  classic: 'klasyczna',
  elegant: 'elegancka',
  feminine: 'kobieca',
  minimalist: 'minimalistyczna',
  casual: 'casual',
  romantic: 'romantyczna',
  modern: 'nowoczesna',
  bold: 'wyrazista',
};

// ---------------------------------------------------------------------------
// KROJE KOMPATYBILNE Z KATEGORIAMI (ALLOWLISTY PER CATEGORY)
// ---------------------------------------------------------------------------

export type VtonCategory = 'upper_body' | 'lower_body' | 'dresses' | null;

export const ALLOWED_VTON_CATEGORIES = ['upper_body', 'lower_body', 'dresses'] as const;
export type ValidVtonCategory = (typeof ALLOWED_VTON_CATEGORIES)[number];

export function isValidVtonCategory(category: unknown): category is ValidVtonCategory {
  return typeof category === 'string' && (ALLOWED_VTON_CATEGORIES as readonly string[]).includes(category.trim());
}

export interface CutDefinition {
  id: string;
  category: ClothingCategory;
  polishSearchTerm: string;
  uiLabel: string;
  vtonCategory: VtonCategory;
}

export const CATEGORY_CUTS: Record<ClothingCategory, CutDefinition[]> = {
  dresses: [
    { id: 'wrap_dress', category: 'dresses', polishSearchTerm: 'kopertowa', uiLabel: 'Krój kopertowy z wiązaniem', vtonCategory: 'dresses' },
    { id: 'a_line_dress', category: 'dresses', polishSearchTerm: 'o linii A', uiLabel: 'Sukienka rozkloszowana o linii A', vtonCategory: 'dresses' },
    { id: 'empire_dress', category: 'dresses', polishSearchTerm: 'empire', uiLabel: 'Fason empire odcinany pod biustem', vtonCategory: 'dresses' },
    { id: 'sheath_dress', category: 'dresses', polishSearchTerm: 'ołówkowa', uiLabel: 'Krój prosty ołówkowy', vtonCategory: 'dresses' },
    { id: 'fit_and_flare_dress', category: 'dresses', polishSearchTerm: 'rozkloszowana', uiLabel: 'Fason dopasowany z rozkloszowanym dołem', vtonCategory: 'dresses' },
    { id: 'trapeze_dress', category: 'dresses', polishSearchTerm: 'trapezowa', uiLabel: 'Krój trapezowy', vtonCategory: 'dresses' },
    { id: 'shift_dress', category: 'dresses', polishSearchTerm: 'prosta shift', uiLabel: 'Prosta sukienka shift', vtonCategory: 'dresses' },
  ],
  tops: [
    { id: 'wrap_top', category: 'tops', polishSearchTerm: 'kopertowa', uiLabel: 'Bluzka kopertowa z dekoltem V', vtonCategory: 'upper_body' },
    { id: 'v_neck_top', category: 'tops', polishSearchTerm: 'dekolt V', uiLabel: 'Top z dekoltem w serek', vtonCategory: 'upper_body' },
    { id: 'shirt_cut_top', category: 'tops', polishSearchTerm: 'koszulowa klasyczna', uiLabel: 'Koszula o klasycznym kroju', vtonCategory: 'upper_body' },
    { id: 'boat_neck_top', category: 'tops', polishSearchTerm: 'dekolt w łódkę', uiLabel: 'Bluzka z dekoltem w łódkę', vtonCategory: 'upper_body' },
    { id: 'peplum_top', category: 'tops', polishSearchTerm: 'z baskinką', uiLabel: 'Top z baskinką akcentujący talię', vtonCategory: 'upper_body' },
    { id: 'loose_fit_top', category: 'tops', polishSearchTerm: 'luźna zwiewna', uiLabel: 'Zwiewna bluzka o luźnym kroju', vtonCategory: 'upper_body' },
  ],
  skirts: [
    { id: 'a_line_skirt', category: 'skirts', polishSearchTerm: 'o linii A rozkloszowana', uiLabel: 'Spódnica o linii A', vtonCategory: 'lower_body' },
    { id: 'pencil_skirt', category: 'skirts', polishSearchTerm: 'ołówkowa midi', uiLabel: 'Spódnica ołówkowa', vtonCategory: 'lower_body' },
    { id: 'pleated_skirt', category: 'skirts', polishSearchTerm: 'plisowana midi', uiLabel: 'Spódnica plisowana', vtonCategory: 'lower_body' },
    { id: 'wrap_skirt', category: 'skirts', polishSearchTerm: 'kopertowa', uiLabel: 'Spódnica kopertowa z wiązaniem', vtonCategory: 'lower_body' },
    { id: 'trapeze_skirt', category: 'skirts', polishSearchTerm: 'trapezowa', uiLabel: 'Spódnica trapezowa', vtonCategory: 'lower_body' },
  ],
  pants: [
    { id: 'wide_leg_pants', category: 'pants', polishSearchTerm: 'z szeroką nogawką wide leg', uiLabel: 'Spodnie z szerokimi nogawkami', vtonCategory: 'lower_body' },
    { id: 'straight_pants', category: 'pants', polishSearchTerm: 'o prostym kroju', uiLabel: 'Spodnie o prostej nogawce', vtonCategory: 'lower_body' },
    { id: 'high_waist_pants', category: 'pants', polishSearchTerm: 'z wysokim stanem', uiLabel: 'Spodnie z wysokim stanem', vtonCategory: 'lower_body' },
    { id: 'cigarette_pants', category: 'pants', polishSearchTerm: 'cygaretki', uiLabel: 'Cygaretki o długości 7/8', vtonCategory: 'lower_body' },
    { id: 'palazzo_pants', category: 'pants', polishSearchTerm: 'palazzo zwiewne', uiLabel: 'Eleganckie spodnie palazzo', vtonCategory: 'lower_body' },
  ],
  blazers: [
    { id: 'tailored_blazer', category: 'blazers', polishSearchTerm: 'taliowana', uiLabel: 'Marynarka taliowana z jednym guzikiem', vtonCategory: 'upper_body' },
    { id: 'oversize_blazer', category: 'blazers', polishSearchTerm: 'o prostym kroju', uiLabel: 'Marynarka o swobodnym kroju', vtonCategory: 'upper_body' },
    { id: 'belted_blazer', category: 'blazers', polishSearchTerm: 'z paskiem w talii', uiLabel: 'Żakiet wiązany paskiem', vtonCategory: 'upper_body' },
    { id: 'cropped_blazer', category: 'blazers', polishSearchTerm: 'krótka pudełkowa', uiLabel: 'Krótki żakiet', vtonCategory: 'upper_body' },
  ],
  outerwear: [
    { id: 'trench_coat', category: 'outerwear', polishSearchTerm: 'trencz z paskiem', uiLabel: 'Klasyczny trencz dwurzędowy', vtonCategory: 'upper_body' },
    { id: 'wrap_coat', category: 'outerwear', polishSearchTerm: 'szlafrokowy wiązany', uiLabel: 'Płaszcz szlafrokowy z paskiem', vtonCategory: 'upper_body' },
    { id: 'single_breasted_coat', category: 'outerwear', polishSearchTerm: 'jednorzędowy prosty', uiLabel: 'Płaszcz jednorzędowy o prostej linii', vtonCategory: 'upper_body' },
    { id: 'cocoon_coat', category: 'outerwear', polishSearchTerm: 'o linii kokonu', uiLabel: 'Płaszcz o miękkiej linii', vtonCategory: 'upper_body' },
  ],
  full_outfit: [
    { id: 'tailored_suit', category: 'full_outfit', polishSearchTerm: 'garnitur damski elegancki', uiLabel: 'Garnitur damski z taliowaną marynarką', vtonCategory: null },
    { id: 'dress_and_blazer', category: 'full_outfit', polishSearchTerm: 'sukienka z żakietem komplet', uiLabel: 'Zestaw: sukienka i dopasowany żakiet', vtonCategory: null },
    { id: 'monochrome_set', category: 'full_outfit', polishSearchTerm: 'komplet monochromatyczny', uiLabel: 'Stylizacja monochromatyczna', vtonCategory: null },
  ],
};

// Domyślny krój rezerwowy (fallback) dla każdej kategorii
export const CATEGORY_FALLBACK_CUT: Record<ClothingCategory, CutDefinition> = {
  dresses: CATEGORY_CUTS.dresses[0], // wrap_dress
  tops: CATEGORY_CUTS.tops[0], // wrap_top
  skirts: CATEGORY_CUTS.skirts[0], // a_line_skirt
  pants: CATEGORY_CUTS.pants[1], // straight_pants
  blazers: CATEGORY_CUTS.blazers[0], // tailored_blazer
  outerwear: CATEGORY_CUTS.outerwear[0], // trench_coat
  full_outfit: CATEGORY_CUTS.full_outfit[0], // tailored_suit (vtonCategory: null)
};

// ---------------------------------------------------------------------------
// SANITYZACJA PÓL TEKSTOWYCH
// ---------------------------------------------------------------------------

/**
 * Usuwa znaki sterujące, znaki zero-width, BOM i normalizuje tekst do Unicode NFC.
 * Nie obcina tekstu, jeśli nie podano maxLength.
 */
export function sanitizeUserText(value: unknown, maxLength?: number): string {
  if (typeof value !== 'string') return '';

  // 1. Unicode normalize NFC
  let text = value.normalize('NFC');

  // 2. Usunięcie znaków zero-width, BOM i bidi overrides: U+200B-U+200D, U+2060, U+FEFF, U+202A-U+202E, U+2066-U+2069
  text = text.replace(/[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g, '');

  // 3. Usunięcie znaków sterujących ASCII poza dozwolonymi: newline (10) i tab (9)
  text = Array.from(text)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (code >= 32 || code === 10 || code === 9) && code !== 127;
    })
    .join('');

  // 4. Opcjonalne ograniczenie długości (jeśli wyraźnie zażądano)
  if (typeof maxLength === 'number' && maxLength > 0) {
    text = Array.from(text).slice(0, maxLength).join('');
  }

  return text;
}

// ---------------------------------------------------------------------------
// WALIDACJA PREFERENCJI STYLIZACJI (SERWER I KLIENT)
// ---------------------------------------------------------------------------

export interface ValidationSuccess {
  valid: true;
  preferences: StylingPreferences;
}

export interface ValidationError {
  valid: false;
  error: string;
}

export type ValidationResult = ValidationSuccess | ValidationError;

export function validateStylingPreferences(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, error: 'Brak lub nieprawidłowy obiekt preferencji stylizacji.' };
  }

  const raw = input as Record<string, unknown>;

  // 1. Kategoria (wymagana z allowlisty)
  if (typeof raw.category !== 'string' || !CLOTHING_CATEGORIES.includes(raw.category as ClothingCategory)) {
    return {
      valid: false,
      error: `Nieprawidłowa kategoria ubrania. Dozwolone: ${CLOTHING_CATEGORIES.join(', ')}.`,
    };
  }
  const category = raw.category as ClothingCategory;

  // 2. Okazja (wymagana z allowlisty)
  if (typeof raw.occasion !== 'string' || !OCCASIONS.includes(raw.occasion as Occasion)) {
    return {
      valid: false,
      error: `Nieprawidłowa okazja. Dozwolone: ${OCCASIONS.join(', ')}.`,
    };
  }
  const occasion = raw.occasion as Occasion;

  // 3. customOccasion (wymagane wyłącznie gdy occasion === 'other'; przekroczenie limitu 80 jest ODRZUCANE)
  let customOccasion: string | undefined = undefined;
  if (occasion === 'other') {
    if (typeof raw.customOccasion !== 'string') {
      return {
        valid: false,
        error: 'Dla wybranej opcji "inna okazja" wymagane jest podanie tekstu (od 2 do 80 znaków).',
      };
    }
    const sanitizedCustom = sanitizeUserText(raw.customOccasion).trim();
    if (sanitizedCustom.length < 2) {
      return {
        valid: false,
        error: 'Opis własnej okazji musi mieć co najmniej 2 znaki.',
      };
    }
    if (sanitizedCustom.length > 80) {
      return {
        valid: false,
        error: 'Opis własnej okazji nie może przekraczać 80 znaków.',
      };
    }
    customOccasion = sanitizedCustom;
  }

  // 4. Style (tablica 0–3 unikalne wartości z allowlisty; duplikaty i >3 odrzucane)
  if (!Array.isArray(raw.styles)) {
    return { valid: false, error: 'Pole "styles" musi być tablicą.' };
  }

  const rawStyles = raw.styles as unknown[];
  if (rawStyles.length > 3) {
    return { valid: false, error: 'Możesz wybrać maksymalnie 3 preferowane style.' };
  }

  const uniqueStyles: StylePreference[] = [];
  for (const item of rawStyles) {
    if (typeof item !== 'string' || !STYLE_PREFERENCES.includes(item as StylePreference)) {
      return {
        valid: false,
        error: `Nieprawidłowy styl "${String(item)}". Dozwolone: ${STYLE_PREFERENCES.join(', ')}.`,
      };
    }
    if (uniqueStyles.includes(item as StylePreference)) {
      return {
        valid: false,
        error: `Zduplikowany styl "${item}". Każdy styl może być wybrany tylko raz.`,
      };
    }
    uniqueStyles.push(item as StylePreference);
  }

  // 5. Notes (opcjonalne, max 240 znaków; przekroczenie limitu odrzucane)
  let notes: string | undefined = undefined;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      return { valid: false, error: 'Pole "notes" musi być tekstem.' };
    }
    const sanitizedNotes = sanitizeUserText(raw.notes).trim();
    if (sanitizedNotes.length > 240) {
      return {
        valid: false,
        error: 'Wskazówki (notes) nie mogą przekraczać 240 znaków.',
      };
    }
    if (sanitizedNotes.length > 0) {
      notes = sanitizedNotes;
    }
  }

  return {
    valid: true,
    preferences: {
      category,
      occasion,
      customOccasion,
      styles: uniqueStyles,
      notes,
    },
  };
}

// ---------------------------------------------------------------------------
// PARSER ODPOWIEDZI MODELU GEMINI (ŚCISŁA WALIDACJA KONTRAKTU)
// ---------------------------------------------------------------------------

export interface RawGeminiAnalysis {
  uiTitle: string;
  stylistComment: string;
  recommendedCut: string;
  strength: string;
  advice: string;
  considerations: string;
}

export type GeminiParseResult =
  | { success: true; data: RawGeminiAnalysis }
  | { success: false; error: string };

/**
 * Ścisły parser odpowiedzi modelu Gemini.
 * Odrzuca brak wymaganych pól, nieprawidłowe typy, puste teksty i wartości spoza limitów.
 * Nie przepuszcza nieoczekiwanych pól (np. avoid, replicatePrompt, bodyShape).
 */
export function parseGeminiAnalysisResponse(raw: unknown): GeminiParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { success: false, error: 'Odpowiedź modelu nie jest obiektem JSON.' };
  }

  const obj = raw as Record<string, unknown>;

  // Sprawdzenie liczby pól (ochrona przed payload abuse)
  const keys = Object.keys(obj);
  if (keys.length > 20) {
    return { success: false, error: 'Odpowiedź modelu zawiera nadmierną liczbę pól.' };
  }

  const fieldsConfig: Record<keyof RawGeminiAnalysis, { min: number; max: number; label: string }> = {
    uiTitle: { min: 3, max: 120, label: 'uiTitle' },
    stylistComment: { min: 10, max: 500, label: 'stylistComment' },
    recommendedCut: { min: 2, max: 80, label: 'recommendedCut' },
    strength: { min: 5, max: 300, label: 'strength' },
    advice: { min: 5, max: 300, label: 'advice' },
    considerations: { min: 5, max: 300, label: 'considerations' },
  };

  const parsed: Partial<RawGeminiAnalysis> = {};

  for (const [key, config] of Object.entries(fieldsConfig) as [keyof RawGeminiAnalysis, { min: number; max: number; label: string }][]) {
    const val = obj[key];
    if (typeof val !== 'string') {
      return { success: false, error: `Brak lub nieprawidłowy typ pola "${config.label}" (oczekiwano string).` };
    }
    const trimmed = val.trim();
    if (trimmed.length < config.min || trimmed.length > config.max) {
      return {
        success: false,
        error: `Pole "${config.label}" ma nieprawidłową długość (${trimmed.length} znaków; wymagane: ${config.min}–${config.max}).`,
      };
    }
    parsed[key] = trimmed;
  }

  return {
    success: true,
    data: parsed as RawGeminiAnalysis,
  };
}

// ---------------------------------------------------------------------------
// DETERMINISTYCZNE BUDOWANIE apiQuery
// ---------------------------------------------------------------------------

/**
 * Buduje deterministyczne zapytanie tekstowe do wyszukiwarki produktów Serper.
 *
 * Formuła deterministyczna:
 * [nazwa kategorii] + " " + [nazwa kroju z allowlisty] + " " + [modyfikator okazji] (+ opcjonalnie max 1 styl)
 *
 * Zasady krytyczne:
 * - Kategoria ZAWSZE występuje w zapytaniu.
 * - Krój MUSI należeć do allowlisty danej kategorii; jeśli Gemini zwróci krój nieznany lub
 *   niekompatybilny (np. wrap_dress dla spodni), stosowany jest bezpieczny fallback dla danej kategorii.
 * - Pole `notes` oraz `customOccasion` NIGDY nie wchodzą bezpośrednio do zapytania.
 * - Najwyżej jeden zatwierdzony styl z allowlisty może zostać dołączony.
 */
export function buildDeterministicApiQuery(
  preferences: StylingPreferences,
  rawRecommendedCut?: string
): { query: string; cut: CutDefinition; fallbackUsed: boolean } {
  const category = preferences.category;
  const cutsForCategory = CATEGORY_CUTS[category] || [CATEGORY_FALLBACK_CUT[category]];

  // 1. Weryfikacja kroju
  let matchedCut: CutDefinition | undefined;
  if (rawRecommendedCut && typeof rawRecommendedCut === 'string') {
    const normalizedCutId = rawRecommendedCut.trim().toLowerCase();
    matchedCut = cutsForCategory.find((c) => c.id === normalizedCutId);
  }

  const fallbackUsed = !matchedCut;
  const cut = matchedCut || CATEGORY_FALLBACK_CUT[category];

  // 2. Składanie elementów zapytania
  const categoryTerm = CATEGORY_SEARCH_TERMS[category];
  const cutTerm = cut.polishSearchTerm;
  const occasionTerm = OCCASION_SEARCH_TERMS[preferences.occasion];

  // Opcjonalny styl (maksymalnie 1)
  let styleTerm = '';
  if (preferences.styles.length > 0) {
    const firstStyle = preferences.styles[0];
    styleTerm = STYLE_SEARCH_TERMS[firstStyle] || '';
  }

  // Złożenie zapytania
  const parts = [categoryTerm, cutTerm, occasionTerm];
  if (styleTerm) {
    parts.push(styleTerm);
  }

  const query = parts.filter(Boolean).join(' ').trim();

  return { query, cut, fallbackUsed };
}

// ---------------------------------------------------------------------------
// DETERMINISTYCZNE BUDOWANIE replicatePrompt (NIE MOŻE POCHODZIĆ Z GEMINI!)
// ---------------------------------------------------------------------------

/**
 * Buduje bezpieczny, deterministyczny prompt techniczny do modelu Virtual Try-On (Replicate).
 *
 * Zasady krytyczne:
 * - Zbudowany WYŁĄCZNIE z zwalidowanej kategorii i zatwierdzonego CutDefinition.
 * - DLA 'full_outfit' ZWRACA null (brak wsparcia VTON dla całej wieloczęściowej stylizacji).
 * - NIGDY nie zawiera pola notes, customOccasion, danych użytkownika ani tekstu z Gemini.
 */
export function buildDeterministicReplicatePrompt(
  category: ClothingCategory,
  cut: CutDefinition
): string | null {
  if (category === 'full_outfit' || cut.vtonCategory === null) {
    return null;
  }

  const englishCutMap: Record<string, string> = {
    wrap_dress: 'wrap dress with waist tie',
    a_line_dress: 'A-line flared dress',
    empire_dress: 'empire waist dress',
    sheath_dress: 'sheath pencil dress',
    fit_and_flare_dress: 'fit and flare skater dress',
    trapeze_dress: 'trapeze dress',
    shift_dress: 'straight shift dress',
    wrap_top: 'wrap blouse with v-neckline',
    v_neck_top: 'v-neck top blouse',
    shirt_cut_top: 'classic tailored button-down shirt',
    boat_neck_top: 'boat neck elegant top',
    peplum_top: 'peplum waist accent top',
    loose_fit_top: 'loose flowing elegant blouse',
    a_line_skirt: 'A-line flared skirt',
    pencil_skirt: 'pencil midi skirt',
    pleated_skirt: 'pleated midi skirt',
    wrap_skirt: 'wrap midi skirt with tie',
    trapeze_skirt: 'trapeze skirt',
    wide_leg_pants: 'wide leg flowing trousers',
    straight_pants: 'straight leg classic trousers',
    high_waist_pants: 'high waist tailored trousers',
    cigarette_pants: 'cigarette slim trousers',
    palazzo_pants: 'flowing palazzo trousers',
    tailored_blazer: 'tailored single-breasted blazer',
    oversize_blazer: 'relaxed fit blazer jacket',
    belted_blazer: 'belted tailored blazer',
    cropped_blazer: 'cropped boxy blazer',
    trench_coat: 'classic double-breasted trench coat',
    wrap_coat: 'wrap coat with fabric belt',
    single_breasted_coat: 'single-breasted wool coat',
    cocoon_coat: 'soft cocoon silhouette coat',
  };

  const englishCut = englishCutMap[cut.id] || cut.id.replace(/_/g, ' ');
  return `${englishCut}, high quality fashion photography, clean neutral studio lighting`;
}

// ---------------------------------------------------------------------------
// 7. BEZPIECZNA KONSTRUKCJA PAYLOADU VTON DLA MODELU IDM-VTON
// ---------------------------------------------------------------------------

export const VTON_MODEL_CONSTANTS = {
  MODEL_GUIDANCE_SCALE: 2.5,
  MODEL_INFERENCE_STEPS: 30,
  MODEL_SEED: 42,
} as const;

export type AllowedVtonCategory = 'upper_body' | 'lower_body' | 'dresses';

/**
 * Buduje bezpieczny, deterministyczny opis odzieży dla modelu IDM-VTON na serwerze.
 * Całkowicie uniezależniony od niezaufanych danych wejściowych klienta (prompt injection immunity).
 */
export function buildServerVtonGarmentDescription(category: AllowedVtonCategory): string {
  switch (category) {
    case 'dresses':
      return 'high quality elegant dress, photorealistic clothing, clean studio fashion photography';
    case 'upper_body':
      return 'high quality top garment, photorealistic clothing, clean studio fashion photography';
    case 'lower_body':
      return 'high quality bottom garment, photorealistic clothing, clean studio fashion photography';
  }
}

export interface ReplicateVtonPayloadInput {
  humanSignedUrl: string;
  garm_img: string;
  category: AllowedVtonCategory;
}

export interface ReplicateVtonPayload {
  human_img: string;
  garm_img: string;
  garment_des: string;
  category: AllowedVtonCategory;
  force_dc: boolean;
  num_inference_steps: number;
  guidance_scale: number;
  seed: number;
  crop: boolean;
}

/**
 * Zwraca właściwy obiekt wejściowy przekazywany bezpośrednio do Replicate IDM-VTON.
 */
export function buildReplicateVtonPayload(params: ReplicateVtonPayloadInput): ReplicateVtonPayload {
  const finalGarmentDes = buildServerVtonGarmentDescription(params.category);
  const finalForceDc = params.category === 'dresses';

  return {
    human_img: params.humanSignedUrl,
    garm_img: params.garm_img,
    garment_des: finalGarmentDes,
    category: params.category,
    force_dc: finalForceDc,
    num_inference_steps: VTON_MODEL_CONSTANTS.MODEL_INFERENCE_STEPS,
    guidance_scale: VTON_MODEL_CONSTANTS.MODEL_GUIDANCE_SCALE,
    seed: VTON_MODEL_CONSTANTS.MODEL_SEED,
    crop: false,
  };
}

