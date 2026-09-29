'use client';

import React, { useState, useEffect, useRef, ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { authenticatedFetch, AuthenticationRequiredError } from '@/lib/auth-fetch';
import { CanonicalProduct, hasVerifiedTryOnAsset } from '@/types/product';
import {
  ClothingCategory,
  Occasion,
  StylePreference,
  StylingPreferences,
  CLOTHING_CATEGORIES,
  OCCASIONS,
  STYLE_PREFERENCES,
  CATEGORY_NAMES,
  OCCASION_NAMES,
  STYLE_NAMES,
  CATEGORY_CUTS,
  CATEGORY_FALLBACK_CUT,
  sanitizeUserText,
  VtonCategory,
  ValidVtonCategory,
  isValidVtonCategory,
} from '@/types/styling';
import { useMarket } from './MarketContext';
import { Loader2 } from 'lucide-react';

export type StudioView = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J1' | 'J2' | 'J3';

export type ProductLoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

// Optymalizacja obrazu na Canvas do formatu JPEG przed wysyłką
const processImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Nie udało się uzyskać kontekstu Canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Błąd ładowania obrazu'));
    };
    reader.onerror = () => reject(new Error('Błąd odczytu pliku'));
  });
};

interface AnalysisResult {
  uiTitle: string;
  apiQuery: string;
  stylistComment: string;
  strength: string;
  advice: string;
  considerations: string;
  recommendedCut: string;
  replicateCategory: VtonCategory;
  replicatePrompt: string | null;
  preferences?: StylingPreferences;
}

interface StyleRecommendationCard {
  id: string;
  title: string;
  reason: string;
  badges: string[];
  tip: string;
  category: ClothingCategory;
}

export interface TryOnValidationResult {
  canProceed: boolean;
  error?: string;
  vtonCategory?: ValidVtonCategory;
}

/**
 * Czysta walidacja kwalifikacji produktu i kategorii przed uruchomieniem procedury przymiarki.
 * Gwarantuje, że niepoprawna kategoria lub brakujące zasoby nie wprowadzą UI w stan ładowania.
 */
export function validateTryOnPrerequisites(params: {
  personBase64: string | null;
  isAppProcessing: boolean;
  isTryOnLoading: boolean;
  product: CanonicalProduct;
  replicateCategory: unknown;
}): TryOnValidationResult {
  if (!params.personBase64 || params.isAppProcessing || params.isTryOnLoading) {
    return { canProceed: false };
  }

  if (!hasVerifiedTryOnAsset(params.product)) {
    return {
      canProceed: false,
      error: 'Ten produkt nie jest obecnie dostępny do wirtualnej przymiarki.',
    };
  }

  const clothingImageUrl = params.product.tryOnAsset?.image?.url;
  const clothingTitle = params.product.title;

  if (!clothingImageUrl || !clothingTitle || !clothingImageUrl.trim() || !clothingTitle.trim()) {
    return {
      canProceed: false,
      error: 'Ten produkt nie jest obecnie dostępny do wirtualnej przymiarki.',
    };
  }

  if (!params.replicateCategory || !isValidVtonCategory(params.replicateCategory)) {
    return {
      canProceed: false,
      error: 'Wirtualna przymiarka nie jest dostępna dla pełnych stylizacji ani tego typu asortymentu.',
    };
  }

  return {
    canProceed: true,
    vtonCategory: params.replicateCategory,
  };
}

export interface ClientTryOnRequestPayload {
  requestId: string;
  personImage: string;
  clothingImage: string;
  category: ValidVtonCategory;
}

/**
 * Buduje bezpieczny payload żądania do /api/try-on.
 * Całkowicie wyklucza przekazywanie porad Gemini (advice), modyfikatorów sylwetki czy swobodnych promptów tekstowych.
 */
export function buildClientTryOnRequestPayload(params: {
  requestId: string;
  personImage: string;
  clothingImageUrl: string;
  category: ValidVtonCategory;
}): ClientTryOnRequestPayload {
  return {
    requestId: params.requestId,
    personImage: params.personImage,
    clothingImage: params.clothingImageUrl,
    category: params.category,
  };
}

export interface TryOnWidgetInitialState {
  initialView?: StudioView;
  initialProducts?: CanonicalProduct[];
  initialAnalysisResult?: AnalysisResult | null;
  initialPersonBase64?: string | null;
  initialUser?: User | { uid: string; email?: string | null; displayName?: string | null } | null;
  initialSelectedCategory?: ClothingCategory | null;
}

export interface TryOnWidgetProps {
  initialState?: TryOnWidgetInitialState;
  customFetch?: typeof authenticatedFetch;
}

export default function TryOnWidget({ initialState, customFetch }: TryOnWidgetProps = {}): React.ReactElement {
  const effectiveFetch = customFetch || authenticatedFetch;
  const { market } = useMarket();

  // 1. Nawigacja i stan maszyny widoków
  const [currentView, setCurrentView] = useState<StudioView>(initialState?.initialView ?? 'A');

  // 2. Preferencje stylizacji (R3C)
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | null>(initialState?.initialSelectedCategory ?? null);
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
  const [customOccasion, setCustomOccasion] = useState<string>('');
  const [selectedStyles, setSelectedStyles] = useState<StylePreference[]>([]);
  const [notes, setNotes] = useState<string>('');

  // 3. Stan zdjęcia i pliku
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [personBase64, setPersonBase64] = useState<string | null>(initialState?.initialPersonBase64 ?? null);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Zgoda na analizę sylwetki
  const [consentChecked, setConsentChecked] = useState<boolean>(false);

  // 5. Stan uwierzytelnienia użytkownika
  const [user, setUser] = useState<User | { uid: string; email?: string | null; displayName?: string | null } | null>(initialState?.initialUser ?? null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const prevUserUidRef = useRef<string | null>(initialState?.initialUser ? initialState.initialUser.uid : null);

  // 6. Stan analizy sylwetki
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(initialState?.initialAnalysisResult ?? null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);

  // 7. Stan produktów i wyszukiwarki
  const [products, setProducts] = useState<CanonicalProduct[]>(initialState?.initialProducts ?? []);
  const [productLoadStatus, setProductLoadStatus] = useState<ProductLoadStatus>(initialState?.initialProducts?.length ? 'ready' : 'idle');

  // 8. Stan wirtualnej przymiarki (VTON)
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);
  const [isTryOnLoading, setIsTryOnLoading] = useState<boolean>(false);
  const [isAppProcessing, setIsAppProcessing] = useState<boolean>(false);

  // 9. Stan okna modalnego potwierdzenia resetu
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const resetModalOpenerRef = useRef<HTMLElement | null>(null);
  const resetModalCancelBtnRef = useRef<HTMLButtonElement>(null);

  // 10. Ochrona przed wyścigami: liczniki generacji i AbortControllers
  const studioGenerationRef = useRef<number>(0);
  const imageProcessingGenerationRef = useRef<number>(0);
  const analysisInFlightRef = useRef<boolean>(false);
  const tryOnInFlightRef = useRef<boolean>(false);

  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const productsAbortControllerRef = useRef<AbortController | null>(null);
  const tryOnAbortControllerRef = useRef<AbortController | null>(null);

  // Reset zgody po każdej zmianie zdjęcia (Wymóg R3C)
  const resetConsentAfterPhotoChange = () => {
    setConsentChecked(false);
  };

  // Pełny reset sesji Studia
  const resetStudio = () => {
    studioGenerationRef.current += 1;
    imageProcessingGenerationRef.current += 1;
    analysisInFlightRef.current = false;
    tryOnInFlightRef.current = false;

    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
      analysisAbortControllerRef.current = null;
    }
    if (productsAbortControllerRef.current) {
      productsAbortControllerRef.current.abort();
      productsAbortControllerRef.current = null;
    }
    if (tryOnAbortControllerRef.current) {
      tryOnAbortControllerRef.current.abort();
      tryOnAbortControllerRef.current = null;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setSelectedCategory(null);
    setSelectedOccasion(null);
    setCustomOccasion('');
    setSelectedStyles([]);
    setNotes('');

    setSelectedFile(null);
    setPreviewUrl(null);
    setPersonBase64(null);
    resetConsentAfterPhotoChange();
    setIsImageProcessing(false);
    setFileError(null);

    setAnalysisResult(null);
    setIsAnalysisLoading(false);

    setProducts([]);
    setProductLoadStatus('idle');

    setTryOnImage(null);
    setTryOnError(null);
    setIsTryOnLoading(false);
    setIsAppProcessing(false);

    setIsResetModalOpen(false);
    setCurrentView('A');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Nasłuchiwanie autoryzacji Firebase z czyszczeniem po wylogowaniu
  const isInitialAuthRef = useRef(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const prevUid = prevUserUidRef.current;
      const currentUid = currentUser ? currentUser.uid : null;

      if (isInitialAuthRef.current) {
        isInitialAuthRef.current = false;
        // On the first auth callback, if initialState provided a user and
        // Firebase confirms the same UID, accept without reset.
        // Any mismatch (null = logged out, different UID = account switch)
        // falls through to the standard reset logic below.
        if (initialState?.initialUser && currentUid === initialState.initialUser.uid) {
          prevUserUidRef.current = currentUid;
          setUser(currentUser);
          return;
        }
      }

      if (prevUid !== null && currentUid === null) {
        resetStudio();
      } else if (prevUid !== null && currentUid !== null && prevUid !== currentUid) {
        resetStudio();
      }

      prevUserUidRef.current = currentUid;
      setUser(currentUser);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Czyszczenie URL obiektu przy zmianie lub demontażu
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Przełączanie widoków wewnętrznych
  const showView = (viewId: StudioView) => {
    setCurrentView(viewId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Zmiana preferencji unieważnia dotychczasowe rekomendacje, produkty i aktywne wywołania asynchroniczne
  const handleEditChoices = (targetView: 'B' | 'C' | 'D') => {
    // 1. Zwiększenie generacji unieważnia wszelkie opóźnione odpowiedzi asynchroniczne
    studioGenerationRef.current += 1;
    analysisInFlightRef.current = false;
    tryOnInFlightRef.current = false;

    // 2. Anulowanie trwających żądań HTTP
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
      analysisAbortControllerRef.current = null;
    }
    if (productsAbortControllerRef.current) {
      productsAbortControllerRef.current.abort();
      productsAbortControllerRef.current = null;
    }
    if (tryOnAbortControllerRef.current) {
      tryOnAbortControllerRef.current.abort();
      tryOnAbortControllerRef.current = null;
    }

    // 3. Czyszczenie stanu analizy, produktów i VTON (zdjęcie jest zachowywane zgodnie z zaakceptowanym UX)
    setAnalysisResult(null);
    setIsAnalysisLoading(false);
    setProducts([]);
    setProductLoadStatus('idle');
    setTryOnImage(null);
    setTryOnError(null);
    setIsTryOnLoading(false);
    setIsAppProcessing(false);

    showView(targetView);
  };

  // Obsługa wyboru pliku z natychmiastowym czyszczeniem Base64, walidacją i resetem zgody
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset zgody przy każdej próbie zmiany pliku
    resetConsentAfterPhotoChange();

    // 1. Walidacja typu MIME
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      imageProcessingGenerationRef.current += 1;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setPersonBase64(null);
      setIsImageProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileError('Nieobsługiwany format pliku. Wybierz zdjęcie w formacie JPG, PNG lub WEBP.');
      return;
    }

    // 2. Walidacja pustego pliku
    if (file.size === 0) {
      imageProcessingGenerationRef.current += 1;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setPersonBase64(null);
      setIsImageProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileError('Plik jest pusty. Wybierz poprawne zdjęcie.');
      return;
    }

    // 3. Walidacja rozmiaru (maksymalnie 10 MiB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      imageProcessingGenerationRef.current += 1;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setPersonBase64(null);
      setIsImageProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileError('Plik jest zbyt duży (maksymalnie 10 MB). Wybierz mniejsze zdjęcie.');
      return;
    }

    // 4. Po pozytywnej walidacji: natychmiastowe czyszczenie starego obrazu
    setFileError(null);
    setPersonBase64(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setAnalysisResult(null);
    setProducts([]);
    setProductLoadStatus('idle');
    setTryOnImage(null);
    setTryOnError(null);

    const generation = ++imageProcessingGenerationRef.current;
    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setIsImageProcessing(true);

    try {
      const base64 = await processImage(file);
      if (generation !== imageProcessingGenerationRef.current) return;
      setPersonBase64(base64);
    } catch (err) {
      console.error('Error processing image:', err);
      if (generation !== imageProcessingGenerationRef.current) return;
      setSelectedFile(null);
      setPersonBase64(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileError('Nie udało się przetworzyć wybranego zdjęcia.');
      resetConsentAfterPhotoChange();
      showView('J1');
    } finally {
      if (generation === imageProcessingGenerationRef.current) {
        setIsImageProcessing(false);
      }
    }
  };

  const handleClearPhoto = () => {
    resetConsentAfterPhotoChange();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setPersonBase64(null);
    setIsImageProcessing(false);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Logowanie Google
  const handleGoogleLogin = async (): Promise<User | null> => {
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      setIsSigningIn(false);
      return result.user;
    } catch (err) {
      console.error('Login error:', err);
      setIsSigningIn(false);
      return null;
    }
  };

  // Uruchomienie analizy z synchronicznym mutexem analysisInFlightRef oraz ochroną generacyjną
  const handleStartAnalysis = async () => {
    if (analysisInFlightRef.current) return;
    if (isAnalysisLoading) return;
    if (!selectedCategory || !selectedOccasion) return;
    if (selectedOccasion === 'other' && (!customOccasion.trim() || customOccasion.trim().length < 2)) return;
    if (!selectedFile || !personBase64 || !consentChecked || isImageProcessing) return;

    analysisInFlightRef.current = true;
    setIsAnalysisLoading(true);

    const sessionGen = studioGenerationRef.current;

    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    analysisAbortControllerRef.current = abortController;

    try {
      let currentUser = user;
      if (!currentUser) {
        currentUser = await handleGoogleLogin();
        if (sessionGen !== studioGenerationRef.current) return;
        if (!currentUser) {
          return;
        }
      }

      if (sessionGen !== studioGenerationRef.current) return;
      showView('G');

      const preferencesPayload: StylingPreferences = {
        category: selectedCategory,
        occasion: selectedOccasion,
        customOccasion: selectedOccasion === 'other' ? customOccasion.trim() : undefined,
        styles: selectedStyles,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      const response = await effectiveFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          image: personBase64,
          consent: true,
          preferences: preferencesPayload,
        }),
      });

      if (sessionGen !== studioGenerationRef.current) return;

      const data = await response.json();
      if (sessionGen !== studioGenerationRef.current) return;

      if (!response.ok) {
        if (response.status === 400 || (data.error && data.error.includes('IMAGE'))) {
          showView('J1');
          return;
        }
        showView('J2');
        return;
      }

      // Weryfikacja integralności odpowiedzi z serwera (zakaz globalnych fallbacków na sukienki)
      const isFullOutfit = selectedCategory === 'full_outfit';
      const isReplicateCategoryValid = isFullOutfit
        ? data.replicateCategory === null || data.replicateCategory === undefined
        : ['upper_body', 'lower_body', 'dresses'].includes(data.replicateCategory);

      if (
        !data.uiTitle ||
        typeof data.uiTitle !== 'string' ||
        !data.apiQuery ||
        typeof data.apiQuery !== 'string' ||
        !data.stylistComment ||
        typeof data.stylistComment !== 'string' ||
        !data.strength ||
        typeof data.strength !== 'string' ||
        !data.advice ||
        typeof data.advice !== 'string' ||
        !data.considerations ||
        typeof data.considerations !== 'string' ||
        !data.recommendedCut ||
        typeof data.recommendedCut !== 'string' ||
        !isReplicateCategoryValid
      ) {
        console.error('Invalid analysis response contract from server:', data);
        showView('J2');
        return;
      }

      const result: AnalysisResult = {
        uiTitle: data.uiTitle,
        apiQuery: data.apiQuery,
        stylistComment: data.stylistComment,
        strength: data.strength,
        advice: data.advice,
        considerations: data.considerations,
        recommendedCut: data.recommendedCut,
        replicateCategory: (data.replicateCategory as VtonCategory) ?? null,
        replicatePrompt: typeof data.replicatePrompt === 'string' ? data.replicatePrompt : null,
        preferences: preferencesPayload,
      };

      setAnalysisResult(result);

      // Pobranie produktów w tle dla widoku I
      fetchProductsForView(result.apiQuery, selectedCategory, false);

      // Przejście do widoku rekomendacji krojów H
      showView('H');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (sessionGen !== studioGenerationRef.current) return;
      console.error('Analysis failed:', err);
      if (err instanceof AuthenticationRequiredError) {
        showView('F');
      } else {
        showView('J2');
      }
    } finally {
      if (sessionGen === studioGenerationRef.current) {
        analysisInFlightRef.current = false;
        setIsAnalysisLoading(false);
      }
    }
  };

  // Pobranie produktów z API z obsługą statusu ProductLoadStatus, AbortController i generacji
  const fetchProductsForView = async (query: string, category?: ClothingCategory, navigateOnFinish = false) => {
    const sessionGen = studioGenerationRef.current;

    if (productsAbortControllerRef.current) {
      productsAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    productsAbortControllerRef.current = abortController;

    setProductLoadStatus('loading');
    setProducts([]);

    try {
      const categoryParam = category ? `&category=${encodeURIComponent(category)}` : '';
      const url = `/api/products?q=${encodeURIComponent(query)}&market=${encodeURIComponent(market.marketCode)}${categoryParam}`;
      const response = await effectiveFetch(url, {
        signal: abortController.signal,
      });

      if (sessionGen !== studioGenerationRef.current) return;

      if (!response.ok) {
        setProductLoadStatus('error');
        return;
      }

      const data = await response.json();
      if (sessionGen !== studioGenerationRef.current) return;

      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        setProducts(data.products);
        setProductLoadStatus('ready');
        if (navigateOnFinish) {
          showView('I');
        }
      } else {
        setProducts([]);
        setProductLoadStatus('empty');
        if (navigateOnFinish) {
          showView('J3');
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        return;
      }
      if (sessionGen !== studioGenerationRef.current) return;
      console.warn('Failed to fetch products:', e);
      setProductLoadStatus('error');
    }
  };

  // Obsługa przycisku przejścia do produktów na ekranie H
  const handleViewProducts = () => {
    if (productLoadStatus === 'ready') {
      showView('I');
    } else if (productLoadStatus === 'empty') {
      showView('J3');
    } else if (productLoadStatus === 'idle') {
      if (analysisResult?.apiQuery) {
        fetchProductsForView(analysisResult.apiQuery, selectedCategory || undefined, true);
      }
    }
  };

  // Obsługa wirtualnej przymiarki VTON – bez fallbacku, z ochroną generacyjną i AbortController
  const handleTryOn = async (product: CanonicalProduct) => {
    const validation = validateTryOnPrerequisites({
      personBase64,
      isAppProcessing,
      isTryOnLoading,
      product,
      replicateCategory: analysisResult?.replicateCategory,
    });

    if (!validation.canProceed || !personBase64) {
      if (validation.error) {
        setTryOnError(validation.error);
      }
      return;
    }

    const vtonCategory = validation.vtonCategory!;
    const clothingImageUrl = product.tryOnAsset!.image.url;

    const sessionGen = studioGenerationRef.current;

    if (tryOnAbortControllerRef.current) {
      tryOnAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    tryOnAbortControllerRef.current = abortController;

    if (!user) {
      const loggedIn = await handleGoogleLogin();
      if (sessionGen !== studioGenerationRef.current) return;
      if (!loggedIn) return;
    }

    setIsAppProcessing(true);
    setIsTryOnLoading(true);
    setTryOnImage(null);
    setTryOnError(null);

    const clientRequestId = crypto.randomUUID();

    try {
      const tryOnPayload = buildClientTryOnRequestPayload({
        requestId: clientRequestId,
        personImage: personBase64,
        clothingImageUrl,
        category: vtonCategory,
      });

      const response = await effectiveFetch('/api/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          requestId: clientRequestId,
          personImage: tryOnPayload.personImage,
          clothingImage: tryOnPayload.clothingImage,
          category: tryOnPayload.category,
        }),
      });

      if (sessionGen !== studioGenerationRef.current) return;

      const data = await response.json();
      if (sessionGen !== studioGenerationRef.current) return;

      if (response.status === 402 || data.error === 'CREDIT_REQUIRED') {
        throw new Error(data.message || 'Wykorzystano limit bezpłatnych przymiarek VTON.');
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Błąd generowania przymiarki');
      }

      setTryOnImage(`${data.imageUrl}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (sessionGen !== studioGenerationRef.current) return;
      console.error('Try-On error:', err);
      const msg = err instanceof Error ? err.message : 'Nie udało się wygenerować przymiarki.';
      setTryOnError(msg);
    } finally {
      if (sessionGen === studioGenerationRef.current) {
        setIsTryOnLoading(false);
        setIsAppProcessing(false);
      }
    }
  };

  // Dynamiczne karty rekomendacji dla wybranej kategorii
  const currentCategoryCuts = selectedCategory ? (CATEGORY_CUTS[selectedCategory] || [CATEGORY_FALLBACK_CUT[selectedCategory]]) : [];
  const displayRecommendationCards: StyleRecommendationCard[] = currentCategoryCuts.slice(0, 3).map((cut, idx) => {
    const isRecommendedCut = analysisResult?.recommendedCut === cut.id;
    return {
      id: cut.id,
      title: cut.uiLabel,
      reason: idx === 0 && analysisResult?.advice
        ? analysisResult.advice
        : `Krój ${cut.polishSearchTerm} harmonijnie współgra z proporcjami sylwetki przy wybranej okazji.`,
      badges: isRecommendedCut ? ['Główny wybór stylistki', 'Harmonijna linia'] : ['Swoboda ruchu', 'Lekkość linii'],
      tip: idx === 0 && analysisResult?.considerations
        ? analysisResult.considerations
        : 'Zwracaj uwagę na jakość i układanie się tkaniny w ruchu.',
      category: cut.category,
    };
  });

  // Obsługa klawiatury dla modalu
  const openResetModal = (e?: React.MouseEvent<HTMLElement>) => {
    resetModalOpenerRef.current = (e?.currentTarget as HTMLElement) || document.activeElement as HTMLElement;
    setIsResetModalOpen(true);
    setTimeout(() => {
      resetModalCancelBtnRef.current?.focus();
    }, 50);
  };

  const closeResetModal = () => {
    setIsResetModalOpen(false);
    if (resetModalOpenerRef.current) {
      resetModalOpenerRef.current.focus();
      resetModalOpenerRef.current = null;
    }
  };

  const handleModalKeydown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeResetModal();
      return;
    }
    if (e.key === 'Tab') {
      const modal = document.getElementById('reset-modal');
      if (!modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  };

  // Obsługa wyboru stylów (max 3)
  const toggleStyle = (style: StylePreference) => {
    if (selectedStyles.includes(style)) {
      setSelectedStyles(selectedStyles.filter((s) => s !== style));
    } else {
      if (selectedStyles.length < 3) {
        setSelectedStyles([...selectedStyles, style]);
      }
    }
  };

  // Flagi walidacji
  const isOccasionValid =
    selectedOccasion !== null &&
    (selectedOccasion !== 'other' || (customOccasion.trim().length >= 2 && customOccasion.trim().length <= 80));

  const isPhotoStepReady = selectedFile !== null && personBase64 !== null && consentChecked && !isImageProcessing;

  return (
    <div className="w-full flex flex-col items-center py-5 px-4 sm:px-6">
      {/* SCOPED STYLES matching approved R3C prototype */}
      <style>{`
        .view-card {
          width: 100%;
          max-width: 480px;
          background: #FFFFFF;
          border: 1px solid #EAE3D9;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(36, 34, 32, 0.05);
          display: flex;
          flex-direction: column;
          position: relative;
        }
        @media (min-width: 900px) {
          .view-card.desktop-split {
            max-width: 1040px;
            flex-direction: row;
            padding: 0;
            overflow: hidden;
            align-items: stretch;
          }
          .view-card.desktop-split .form-col {
            flex: 0 0 660px;
            max-width: 660px;
            padding: 32px 36px;
            display: flex;
            flex-direction: column;
            border-right: 1px solid #EAE3D9;
          }
          .view-card.desktop-split .visual-col {
            flex: 1;
            min-width: 220px;
            background: linear-gradient(160deg, #FAF0EF 0%, #F2E4EB 50%, #EDE3F0 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 24px;
            gap: 16px;
          }
        }
        @media (max-width: 899px) {
          .view-card.desktop-split .form-col {
            width: 100%;
            padding: 16px;
            display: flex;
            flex-direction: column;
          }
          .view-card.desktop-split .visual-col {
            display: none;
          }
        }
        .view-card.wide-layout {
          max-width: 1040px;
          padding: 28px;
        }
        .btn-cta {
          width: 100%;
          min-height: 48px;
          background: #83223A;
          color: #FFFFFF;
          border: none;
          border-radius: 12px;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease;
          box-shadow: 0 2px 8px rgba(131, 34, 58, 0.2);
          text-decoration: none;
          margin-top: 14px;
        }
        .btn-cta:hover:not(:disabled) {
          background: #6D1B2F;
          box-shadow: 0 4px 12px rgba(131, 34, 58, 0.3);
        }
        .btn-cta:disabled {
          background: #D3CBC4;
          color: #7D756E;
          cursor: not-allowed;
          box-shadow: none;
        }
        .btn-secondary {
          width: 100%;
          min-height: 48px;
          background: #FFFFFF;
          color: #242220;
          border: 1px solid #D5CCC0;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
          margin-top: 8px;
        }
        .btn-secondary:hover {
          background: #FAF7F2;
        }
        .btn-text-back {
          background: transparent;
          border: none;
          color: #8F867D;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 10px;
          padding: 4px;
          align-self: center;
          transition: color 0.15s;
        }
        .btn-text-back:hover {
          color: #242220;
          text-decoration: underline;
        }
        .option-card {
          border: 1.5px solid #EAE3D9;
          background: #FAF7F2;
          border-radius: 12px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          position: relative;
        }
        .option-card:hover {
          border-color: #E8D5DA;
          background: #FFFFFF;
        }
        .option-card.selected {
          border-color: #83223A;
          background: #FBEFF2;
        }
        .option-card:focus-visible {
          outline: 2px solid #83223A;
          outline-offset: 2px;
        }
        .style-chip {
          border: 1.5px solid #EAE3D9;
          background: #FAF7F2;
          border-radius: 12px;
          padding: 9px 11px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
          font-size: 12.5px;
          font-weight: 600;
          color: #242220;
        }
        .style-chip:hover {
          border-color: #E8D5DA;
          background: #FFFFFF;
        }
        .style-chip.selected {
          border-color: #83223A;
          background: #FBEFF2;
          color: #83223A;
        }
        .style-chip.disabled {
          opacity: 0.45;
          cursor: not-allowed;
          border-color: #EAE3D9;
          background: #FAF7F2;
        }
        .style-chip:focus-visible {
          outline: 2px solid #83223A;
          outline-offset: 2px;
        }
        .upload-box {
          border: 2px dashed #D5CCC0;
          background: #FAF7F2;
          border-radius: 12px;
          padding: 16px 14px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          margin: 10px 0;
          width: 100%;
        }
        .upload-box:hover {
          border-color: #83223A;
          background: #FFFFFF;
        }
        .upload-box:focus-within {
          border-color: #83223A;
          outline: 2px solid #83223A;
          outline-offset: 2px;
        }
        .loader-pulse {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #FBEFF2;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px auto 16px;
        }
        .loader-dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #83223A;
          animation: pulseAnim 1.4s ease-in-out infinite;
        }
        @keyframes pulseAnim {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0.6; }
        }
      `}</style>

      {/* STEPPER (Widoki B do I) */}
      {currentView !== 'A' && (
        <div className="w-full bg-[#FFFFFF] border-b border-[#EAE3D9] py-2.5 px-4 mb-5" id="app-stepper">
          <div className="max-w-[640px] mx-auto flex items-center justify-between relative">
            <div className="absolute top-3 left-[12%] right-[12%] h-[2px] bg-[#EAE3D9] z-0" />
            <div
              className="absolute top-3 left-[12%] h-[2px] bg-[#83223A] z-0 transition-all duration-300"
              style={{
                width:
                  currentView === 'B' || currentView === 'C'
                    ? '0%'
                    : currentView === 'D'
                    ? '33%'
                    : currentView === 'E' || currentView === 'F' || currentView === 'G'
                    ? '66%'
                    : '100%',
              }}
            />
            {/* Węzeł 1 */}
            <div className="flex flex-col items-center gap-1 relative z-10 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                  ['B', 'C'].includes(currentView)
                    ? 'bg-[#83223A] border-[#83223A] text-white ring-4 ring-[#FBEFF2]'
                    : ['D', 'E', 'F', 'G', 'H', 'I', 'J1', 'J2', 'J3'].includes(currentView)
                    ? 'bg-[#FBEFF2] border-[#83223A] text-[#83223A]'
                    : 'bg-[#F4EFEB] border-[#D5CCC0] text-[#6B645C]'
                }`}
              >
                1
              </div>
              <span className={`text-[11px] font-semibold ${['B', 'C'].includes(currentView) ? 'text-[#83223A]' : 'text-[#6B645C]'}`}>
                Potrzeby
              </span>
            </div>
            {/* Węzeł 2 */}
            <div className="flex flex-col items-center gap-1 relative z-10 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                  currentView === 'D'
                    ? 'bg-[#83223A] border-[#83223A] text-white ring-4 ring-[#FBEFF2]'
                    : ['E', 'F', 'G', 'H', 'I', 'J1', 'J2', 'J3'].includes(currentView)
                    ? 'bg-[#FBEFF2] border-[#83223A] text-[#83223A]'
                    : 'bg-[#F4EFEB] border-[#D5CCC0] text-[#6B645C]'
                }`}
              >
                2
              </div>
              <span className={`text-[11px] font-semibold ${currentView === 'D' ? 'text-[#83223A]' : 'text-[#6B645C]'}`}>
                Styl
              </span>
            </div>
            {/* Węzeł 3 */}
            <div className="flex flex-col items-center gap-1 relative z-10 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                  ['E', 'F', 'G', 'J1', 'J2'].includes(currentView)
                    ? 'bg-[#83223A] border-[#83223A] text-white ring-4 ring-[#FBEFF2]'
                    : ['H', 'I', 'J3'].includes(currentView)
                    ? 'bg-[#FBEFF2] border-[#83223A] text-[#83223A]'
                    : 'bg-[#F4EFEB] border-[#D5CCC0] text-[#6B645C]'
                }`}
              >
                3
              </div>
              <span className={`text-[11px] font-semibold ${['E', 'F', 'G'].includes(currentView) ? 'text-[#83223A]' : 'text-[#6B645C]'}`}>
                Zdjęcie
              </span>
            </div>
            {/* Węzeł 4 */}
            <div className="flex flex-col items-center gap-1 relative z-10 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                  ['H', 'I', 'J3'].includes(currentView)
                    ? 'bg-[#83223A] border-[#83223A] text-white ring-4 ring-[#FBEFF2]'
                    : 'bg-[#F4EFEB] border-[#D5CCC0] text-[#6B645C]'
                }`}
              >
                4
              </div>
              <span className={`text-[11px] font-semibold ${['H', 'I'].includes(currentView) ? 'text-[#83223A]' : 'text-[#6B645C]'}`}>
                Rekomendacje
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* WIDOK A — START                                           */}
      {/* ========================================================= */}
      {currentView === 'A' && (
        <section className="view-card desktop-split" id="view-A" aria-labelledby="title-A">
          <div className="form-col">
            <div className="inline-flex items-center gap-1.5 bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA] text-xs font-semibold px-3 py-1 rounded-full mb-2.5 self-center">
              ✨ Osobista Stylistka AI
            </div>
            <h1 className="text-xl font-bold text-[#242220] tracking-tight text-center leading-snug" id="title-A">
              Znajdź fasony stworzone dla Ciebie
            </h1>
            <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
              Powiedz nam, czego szukasz, a następnie dodaj zdjęcie sylwetki. Przygotujemy inspiracje dopasowane do Twoich proporcji, okazji i stylu.
            </p>

            <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 my-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-2.5 text-xs text-[#242220]">
                <span className="w-5 h-5 rounded-full bg-[#FBEFF2] text-[#83223A] font-bold flex items-center justify-center text-[10.5px] shrink-0">1</span>
                <span>Określ kategorię, okazję i swoje preferencje</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[#242220]">
                <span className="w-5 h-5 rounded-full bg-[#FBEFF2] text-[#83223A] font-bold flex items-center justify-center text-[10.5px] shrink-0">2</span>
                <span>Wgraj jedno zdjęcie całej sylwetki w naturalnej pozie</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[#242220]">
                <span className="w-5 h-5 rounded-full bg-[#FBEFF2] text-[#83223A] font-bold flex items-center justify-center text-[10.5px] shrink-0">3</span>
                <span>Odbierz spersonalizowane rekomendacje fasonów i ubrań</span>
              </div>
            </div>

            <button type="button" className="btn-cta" id="cta-view-A" onClick={() => showView('B')}>
              Zaczynamy
            </button>

            <p className="text-[11px] text-[#8F867D] text-center mt-2.5 leading-normal">
              Przed analizą wybierasz swoje preferencje i decydujesz o udostępnieniu zdjęcia.
            </p>
          </div>

          <div className="visual-col" aria-hidden="true">
            <div className="text-[15px] font-bold text-[#83223A] text-center leading-snug">
              Twój styl,<br />Twoje proporcje
              <small className="block text-[11px] font-normal text-[#8F867D] mt-1">Rekomendacje dopasowane do Ciebie</small>
            </div>
            <svg width="120" height="170" viewBox="0 0 140 220" fill="none" focusable="false">
              <ellipse cx="70" cy="22" rx="10" ry="13" fill="#E8DDD3" />
              <path d="M46 40L28 68L42 76L56 54L46 40Z" fill="#88203B" />
              <path d="M94 40L112 68L98 76L84 54L94 40Z" fill="#88203B" />
              <path d="M52 38L70 96H88L88 54L94 38H52Z" fill="#83223A" />
              <path d="M88 38L64 96H80L94 38H88Z" fill="#9E2A4B" />
              <rect x="52" y="94" width="36" height="8" rx="2" fill="#5C1022" />
              <path d="M52 102L38 210H102L88 102H52Z" fill="#83223A" />
            </svg>
            <div className="flex flex-col gap-2.5 w-full max-w-[210px]">
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">✨</div>
                <div><strong className="block text-[#242220] font-bold">Analiza sylwetki</strong>Algorytm dopasowuje fasony do Twoich proporcji.</div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">🎯</div>
                <div><strong className="block text-[#242220] font-bold">Okazja i styl</strong>Wybierz kontekst, a my dobierzemy formalność kroju.</div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">🔒</div>
                <div><strong className="block text-[#242220] font-bold">Świadoma zgoda</strong>Przed rozpoczęciem analizy zobaczysz informację o przetwarzaniu zdjęcia i zdecydujesz, czy chcesz kontynuować.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK B — CZEGO SZUKASZ? (KATEGORIA)                      */}
      {/* ========================================================= */}
      {currentView === 'B' && (
        <section className="view-card desktop-split" id="view-B" aria-labelledby="title-B">
          <div className="form-col">
            <div className="inline-flex items-center gap-1.5 bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA] text-xs font-semibold px-3 py-1 rounded-full mb-2.5 self-center">
              Krok 1 z 3 • Potrzeby
            </div>
            <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-B">
              Czego szukasz?
            </h2>
            <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
              Wybierz jedną kategorię ubrania, dla której przygotujemy rekomendacje fasonów.
            </p>

            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-2 my-4 w-full"
              id="category-options"
              role="radiogroup"
              aria-labelledby="title-B"
            >
              {CLOTHING_CATEGORIES.map((catKey) => {
                const isSelected = selectedCategory === catKey;
                const iconMap: Record<ClothingCategory, string> = {
                  dresses: '👗',
                  tops: '👚',
                  skirts: '🩰',
                  pants: '👖',
                  blazers: '🧥',
                  outerwear: '🧣',
                  full_outfit: '✨',
                };
                return (
                  <div
                    key={catKey}
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    role="radio"
                    aria-checked={isSelected ? 'true' : 'false'}
                    tabIndex={isSelected ? 0 : 0}
                    data-value={catKey}
                    onClick={() => setSelectedCategory(catKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCategory(catKey);
                      }
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#EAE3D9] flex items-center justify-center text-sm shrink-0">
                      {iconMap[catKey]}
                    </div>
                    <span className="text-[13px] font-semibold text-[#242220] flex-1">{CATEGORY_NAMES[catKey]}</span>
                    <div className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${isSelected ? 'border-[#83223A] bg-[#83223A]' : 'border-[#D5CCC0] bg-white'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-cta"
              id="cta-view-B"
              disabled={!selectedCategory}
              onClick={() => showView('C')}
            >
              Dalej
            </button>
            <button type="button" className="btn-text-back" onClick={() => showView('A')}>
              ← Wróć do powitania
            </button>
          </div>

          <div className="visual-col" aria-hidden="true">
            <div className="text-[15px] font-bold text-[#83223A] text-center leading-snug">
              Krok 1 z 3<small className="block text-[11px] font-normal text-[#8F867D] mt-1">Wybierz kategorię ubrania</small>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">👗</div>
                <div><strong className="block text-[#242220] font-bold">7 kategorii</strong>Od sukienek po płaszcze.</div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">🎯</div>
                <div><strong className="block text-[#242220] font-bold">Jeden wybór</strong>Skup się na tym, czego szukasz.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK C — NA JAKĄ OKAZJĘ?                                 */}
      {/* ========================================================= */}
      {currentView === 'C' && (
        <section className="view-card desktop-split" id="view-C" aria-labelledby="title-C">
          <div className="form-col">
            <div className="inline-flex items-center gap-1.5 bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA] text-xs font-semibold px-3 py-1 rounded-full mb-2.5 self-center">
              Krok 1 z 3 • Kontekst
            </div>
            <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-C">
              Na jaką okazję?
            </h2>
            <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
              Okazja pozwala nam dobrać fasony o odpowiednim stopniu formalności i swobody.
            </p>

            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-2 my-4 w-full"
              id="occasion-options"
              role="radiogroup"
              aria-labelledby="title-C"
            >
              {OCCASIONS.map((occKey) => {
                const isSelected = selectedOccasion === occKey;
                const iconMap: Record<Occasion, string> = {
                  daily: '☕',
                  work: '💼',
                  date_evening: '🍸',
                  wedding_party: '🥂',
                  business_formal: '🤝',
                  vacation: '🌴',
                  other: '✏️',
                };
                return (
                  <div
                    key={occKey}
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    role="radio"
                    aria-checked={isSelected ? 'true' : 'false'}
                    tabIndex={isSelected ? 0 : 0}
                    data-value={occKey}
                    onClick={() => setSelectedOccasion(occKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedOccasion(occKey);
                      }
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#EAE3D9] flex items-center justify-center text-sm shrink-0">
                      {iconMap[occKey]}
                    </div>
                    <span className="text-[13px] font-semibold text-[#242220] flex-1">{OCCASION_NAMES[occKey]}</span>
                    <div className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${isSelected ? 'border-[#83223A] bg-[#83223A]' : 'border-[#D5CCC0] bg-white'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedOccasion === 'other' && (
              <div className="w-full flex flex-col gap-1.5 mt-2" id="custom-occasion-box">
                <label htmlFor="custom-occasion-input" className="text-xs font-semibold text-[#242220] flex justify-between">
                  <span>Opisz okazję (wymagane)</span>
                  <span className="text-[11px] text-[#8F867D] font-normal" id="custom-occasion-counter">
                    {customOccasion.length} / 80
                  </span>
                </label>
                <input
                  type="text"
                  id="custom-occasion-input"
                  className="w-full border-[1.5px] border-[#D5CCC0] rounded-lg p-2.5 text-sm bg-white focus:border-[#83223A] focus:outline-none focus:ring-2 focus:ring-[#FBEFF2]"
                  placeholder="Np. chrzciny, obrona pracy magisterskiej, teatr..."
                  maxLength={80}
                  value={customOccasion}
                  onChange={(e) => {
                    const sanitized = sanitizeUserText(e.target.value, 80);
                    setCustomOccasion(sanitized);
                  }}
                />
                {customOccasion.length > 0 && (customOccasion.trim().length < 2 || customOccasion.trim().length > 80) && (
                  <div className="text-[#9E1C38] text-[11px]" id="custom-occasion-error">
                    Wpisz od 2 do 80 znaków (tekst nie może zawierać wyłącznie spacji).
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn-cta"
              id="cta-view-C"
              disabled={!isOccasionValid}
              onClick={() => showView('D')}
            >
              Dalej
            </button>
            <button type="button" className="btn-text-back" onClick={() => showView('B')}>
              ← Wróć do wyboru kategorii
            </button>
          </div>

          <div className="visual-col" aria-hidden="true">
            <div className="text-[15px] font-bold text-[#83223A] text-center leading-snug">
              Krok 1 z 3<small className="block text-[11px] font-normal text-[#8F867D] mt-1">Dobieramy formalność kroju do okazji</small>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">🥂</div>
                <div><strong className="block text-[#242220] font-bold">7 okazji</strong>Od codziennych po uroczyste.</div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">✏️</div>
                <div><strong className="block text-[#242220] font-bold">Własna okazja</strong>Wpisz swoją, jeśli nie ma na liście.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK D — TWÓJ STYL                                       */}
      {/* ========================================================= */}
      {currentView === 'D' && (
        <section className="view-card desktop-split" id="view-D" aria-labelledby="title-D">
          <div className="form-col">
            <div className="inline-flex items-center gap-1.5 bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA] text-xs font-semibold px-3 py-1 rounded-full mb-2.5 self-center">
              Krok 2 z 3 • Styl i preferencje
            </div>
            <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-D">
              Twój styl
            </h2>
            <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
              Wybierz do 3 preferowanych stylów (opcjonalnie) oraz dodaj ewentualne wskazówki.
            </p>

            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-2 my-3.5 w-full"
              id="style-options"
              role="group"
              aria-labelledby="title-D"
            >
              {STYLE_PREFERENCES.map((styleKey) => {
                const isSelected = selectedStyles.includes(styleKey);
                const isDisabled = selectedStyles.length >= 3 && !isSelected;
                return (
                  <div
                    key={styleKey}
                    className={`style-chip ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    role="checkbox"
                    aria-checked={isSelected ? 'true' : 'false'}
                    aria-disabled={isDisabled ? 'true' : 'false'}
                    tabIndex={0}
                    data-value={styleKey}
                    onClick={() => {
                      if (!isDisabled) toggleStyle(styleKey);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!isDisabled) toggleStyle(styleKey);
                      }
                    }}
                  >
                    <span>{STYLE_NAMES[styleKey]}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${isSelected ? 'border-[#83223A] bg-[#83223A] text-white' : 'border-[#D5CCC0] bg-white text-transparent'}`}>
                      ✓
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              id="style-limit-msg"
              aria-live="polite"
              className={`text-[11.5px] text-center min-h-[1.2em] ${selectedStyles.length >= 3 ? 'text-[#92540D] font-semibold' : 'text-[#6B645C]'}`}
            >
              {selectedStyles.length >= 3
                ? 'Wybrano maksymalną liczbę stylów (3). Odznacz jeden, aby wybrać inny.'
                : 'Możesz wybrać maksymalnie 3 style.'}
            </div>

            <div className="w-full flex flex-col gap-1.5 mt-3">
              <label htmlFor="notes-input" className="text-xs font-semibold text-[#242220] flex justify-between">
                <span>Czy jest coś, co mamy uwzględnić? <em className="font-normal text-[#8F867D]">(Opcjonalne)</em></span>
                <span className="text-[11px] text-[#8F867D] font-normal" id="notes-counter">
                  {notes.length} / 240
                </span>
              </label>
              <textarea
                id="notes-input"
                className="w-full min-h-[70px] border-[1.5px] border-[#D5CCC0] rounded-lg p-2.5 text-sm bg-white focus:border-[#83223A] focus:outline-none focus:ring-2 focus:ring-[#FBEFF2] resize-y"
                placeholder="Np. wolę zakryte ramiona, nie noszę bardzo krótkich fasonów, lubię podkreślać talię..."
                maxLength={240}
                value={notes}
                onChange={(e) => {
                  const sanitized = sanitizeUserText(e.target.value, 240);
                  setNotes(sanitized);
                }}
              />
              <p className="text-[10.5px] text-[#8F867D] leading-tight">
                Wskazówki są traktowane wyłącznie jako luźne preferencje estetyczne — nie są używane bezpośrednio do tworzenia zapytań wyszukiwania.
              </p>
            </div>

            <button type="button" className="btn-cta" id="cta-view-D" onClick={() => showView('E')}>
              Przejdź do zdjęcia
            </button>
            <button type="button" className="btn-text-back" onClick={() => showView('C')}>
              ← Wróć do wyboru okazji
            </button>
          </div>

          <div className="visual-col" aria-hidden="true">
            <div className="text-[15px] font-bold text-[#83223A] text-center leading-snug">
              Krok 2 z 3<small className="block text-[11px] font-normal text-[#8F867D] mt-1">Doprecyzuj swój styl</small>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">🎨</div>
                <div><strong className="block text-[#242220] font-bold">Do 3 stylów</strong>Połącz ulubione estetyki.</div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">📝</div>
                <div><strong className="block text-[#242220] font-bold">Twoje wskazówki</strong>Cokolwiek mamy uwzględnić.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK E — INSTRUKCJA ZDJĘCIA                              */}
      {/* ========================================================= */}
      {currentView === 'E' && (
        <section className="view-card desktop-split" id="view-E" aria-labelledby="title-E">
          <div className="form-col">
            <div className="inline-flex items-center gap-1.5 bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA] text-xs font-semibold px-3 py-1 rounded-full mb-2.5 self-center">
              Krok 3 z 3 • Przygotowanie zdjęcia
            </div>
            <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-E">
              Jak przygotować dobre zdjęcie?
            </h2>
            <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
              Trzy proste wskazówki, dzięki którym algorytm trafnie odczyta proporcje Twojej sylwetki.
            </p>

            <div className="flex flex-col gap-2.5 my-4">
              <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 flex gap-3 items-center">
                <div className="w-8 h-8 rounded-lg bg-[#EFF8F3] text-[#1E663B] border border-[#C8E8D5] flex items-center justify-center font-bold text-sm shrink-0">1</div>
                <div>
                  <div className="text-[13.5px] font-bold text-[#242220]">Pokaż całą sylwetkę</div>
                  <div className="text-xs text-[#6B645C] mt-0.5">Kadr od stóp do czubka głowy pozwala ocenić ogólne proporcje.</div>
                </div>
              </div>
              <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 flex gap-3 items-center">
                <div className="w-8 h-8 rounded-lg bg-[#EFF8F3] text-[#1E663B] border border-[#C8E8D5] flex items-center justify-center font-bold text-sm shrink-0">2</div>
                <div>
                  <div className="text-[13.5px] font-bold text-[#242220]">Stań przodem w naturalnej pozycji</div>
                  <div className="text-xs text-[#6B645C] mt-0.5">Swobodna, wyprostowana postawa bez skręcania bioder i tułowia.</div>
                </div>
              </div>
              <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 flex gap-3 items-center">
                <div className="w-8 h-8 rounded-lg bg-[#EFF8F3] text-[#1E663B] border border-[#C8E8D5] flex items-center justify-center font-bold text-sm shrink-0">3</div>
                <div>
                  <div className="text-[13.5px] font-bold text-[#242220]">Wybierz równe, łagodne światło</div>
                  <div className="text-xs text-[#6B645C] mt-0.5">Światło dzienne lub rozproszone oświetlenie ułatwia czytanie konturu.</div>
                </div>
              </div>
            </div>

            <button type="button" className="btn-cta" id="cta-view-E" onClick={() => showView('F')}>
              Wybierz zdjęcie
            </button>
            <button type="button" className="btn-text-back" onClick={() => showView('D')}>
              ← Wróć do preferencji stylu
            </button>
          </div>

          <div className="visual-col" aria-hidden="true">
            <div className="text-[15px] font-bold text-[#83223A] text-center leading-snug">
              Krok 3 z 3<small className="block text-[11px] font-normal text-[#8F867D] mt-1">Zdjęcie sylwetki — wskazówki</small>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">📏</div>
                <div><strong className="block text-[#242220] font-bold">Cała sylwetka</strong>Od stóp do głowy w jednym kadrze.</div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">☀️</div>
                <div><strong className="block text-[#242220] font-bold">Dobre światło</strong>Dzienne lub równomierne oświetlenie.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK F — ZDJĘCIE, PODSUMOWANIE I ZGODA                   */}
      {/* ========================================================= */}
      {currentView === 'F' && (
        <section className="view-card desktop-split" id="view-F" aria-labelledby="title-F">
          <div className="form-col">
            <div className="inline-flex items-center gap-1.5 bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA] text-xs font-semibold px-3 py-1 rounded-full mb-2.5 self-center">
              Krok 3 z 3 • Zatwierdzenie
            </div>
            <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-F">
              Zdjęcie i podsumowanie
            </h2>
            <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
              Sprawdź swoje wybory przed analizą proporcji.
            </p>

            {/* Podsumowanie wyborów z opcją edycji */}
            <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 my-3 w-full">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8F867D] mb-1.5 flex justify-between items-center">
                <span>Twoje wybory</span>
                <button
                  type="button"
                  className="text-[#83223A] underline text-[11.5px] font-bold cursor-pointer p-0.5 hover:text-[#6D1B2F]"
                  onClick={() => handleEditChoices('B')}
                >
                  Edytuj wybory
                </button>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-dashed border-[#EAE3D9]">
                <span className="text-[#6B645C]">Kategoria:</span>
                <span className="font-semibold text-[#242220]">{selectedCategory ? CATEGORY_NAMES[selectedCategory] : '—'}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-dashed border-[#EAE3D9]">
                <span className="text-[#6B645C]">Okazja:</span>
                <span className="font-semibold text-[#242220]">
                  {selectedOccasion
                    ? selectedOccasion === 'other' && customOccasion
                      ? customOccasion
                      : OCCASION_NAMES[selectedOccasion]
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-dashed border-[#EAE3D9]">
                <span className="text-[#6B645C]">Preferencje stylu:</span>
                <span className="font-semibold text-[#242220]">
                  {selectedStyles.length > 0 ? selectedStyles.map((s) => STYLE_NAMES[s]).join(', ') : 'Dopasowany do okazji'}
                </span>
              </div>
              {notes.trim().length > 0 && (
                <div className="flex justify-between text-xs py-1">
                  <span className="text-[#6B645C]">Wskazówki:</span>
                  <span className="font-semibold text-[#242220] max-w-[60%] text-right truncate">{notes.trim()}</span>
                </div>
              )}
            </div>

            {/* Strefa wczytywania zdjęcia */}
            <label htmlFor="demo-file-input" className="upload-box" id="upload-zone">
              <input
                ref={fileInputRef}
                type="file"
                id="demo-file-input"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
              />
              {!previewUrl ? (
                <div className="flex flex-col items-center gap-1 py-2" id="upload-idle-state">
                  <div className="text-2xl">📷</div>
                  <div className="text-[13.5px] font-bold text-[#242220]">Wybierz zdjęcie z urządzenia</div>
                  <div className="text-[11.5px] text-[#8F867D]">JPG, PNG lub WEBP (do 10 MB)</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-1" id="upload-preview-state">
                  {/* Prawdziwy podgląd pliku; brak pustego img src */}
                  <img
                    id="upload-preview-img"
                    src={previewUrl}
                    alt="Podgląd sylwetki"
                    className="max-h-[180px] max-w-full rounded-lg object-contain shadow-xs"
                  />
                  <button
                    type="button"
                    className="text-[11.5px] text-[#83223A] font-bold underline mt-1"
                    onClick={(e) => {
                      e.preventDefault();
                      handleClearPhoto();
                      fileInputRef.current?.click();
                    }}
                  >
                    Zmień zdjęcie
                  </button>
                </div>
              )}
            </label>

            {/* Błąd pliku */}
            {fileError && (
              <div
                id="file-error-msg"
                role="alert"
                aria-live="assertive"
                className="text-[11.5px] text-[#9E1C38] bg-[#FDF2F4] border border-[#F3CAD2] rounded-lg p-2 my-1 text-center"
              >
                {fileError}
              </div>
            )}

            {/* Checkbox zgody prawnej */}
            <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-2.5 mt-2 flex gap-2 items-start w-full">
              <input
                type="checkbox"
                id="consent-check"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="w-4 h-4 accent-[#83223A] mt-0.5 shrink-0 cursor-pointer"
              />
              <label htmlFor="consent-check" className="text-[11.5px] text-[#242220] leading-snug cursor-pointer">
                Wyrażam zgodę na przesłanie zdjęcia do usługi Google Gemini w celu analizy sylwetki i przygotowania rekomendacji fasonów uwzględniających moje wybory.
              </label>
            </div>
            <p className="text-[10.5px] text-[#8F867D] mt-1 px-1 leading-tight">
              Analiza może obejmować cechy widoczne na zdjęciu, takie jak proporcje sylwetki i ułożenie ubrania.
            </p>

            {/* Główny przycisk analizy */}
            <button
              type="button"
              className="btn-cta"
              id="cta-view-F"
              disabled={!isPhotoStepReady}
              onClick={handleStartAnalysis}
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Logowanie...</span>
                </>
              ) : isAnalysisLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Przygotowuję analizę...</span>
                </>
              ) : user ? (
                'Przygotuj rekomendacje'
              ) : (
                'Zaloguj się i przygotuj rekomendacje'
              )}
            </button>
            <button type="button" className="btn-text-back" onClick={() => showView('E')}>
              ← Wróć do instrukcji zdjęcia
            </button>
          </div>

          <div className="visual-col" aria-hidden="true">
            <div className="text-[15px] font-bold text-[#83223A] text-center leading-snug">
              Krok 3 z 3<small className="block text-[11px] font-normal text-[#8F867D] mt-1">Prawie gotowe!</small>
            </div>
            <div className="flex flex-col gap-2.5 w-full max-w-[200px]">
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">🔒</div>
                <div><strong className="block text-[#242220] font-bold">Świadoma zgoda</strong>Przed analizą potwierdzasz przesłanie zdjęcia do usługi AI.</div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#6B645C]">
                <div className="w-7 h-7 rounded-lg bg-[#FBEFF2] text-[#83223A] flex items-center justify-center shrink-0">✔️</div>
                <div><strong className="block text-[#242220] font-bold">Wymagana akcja</strong>Analiza rusza dopiero po Twoim zatwierdzeniu.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK G — OCZEKIWANIE                                     */}
      {/* ========================================================= */}
      {currentView === 'G' && (
        <section className="view-card" id="view-G" aria-labelledby="title-G">
          <div className="loader-pulse">
            <div className="loader-dot" />
          </div>
          <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-G">
            Tworzymy rekomendacje dla Ciebie
          </h2>
          <p className="text-[13px] font-semibold text-[#242220] mt-3 text-center leading-relaxed">
            Łączymy informacje o wybranej okazji i stylu z analizą widocznych proporcji sylwetki.
          </p>
          <p className="text-xs text-[#6B645C] mt-2.5 text-center leading-relaxed">
            Pozostań na tej stronie. Po zakończeniu pokażemy fasony, które mogą dobrze odpowiadać Twoim potrzebom.
          </p>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK H — REKOMENDACJE FASONÓW                            */}
      {/* ========================================================= */}
      {currentView === 'H' && (
        <section className="view-card wide-layout" id="view-H" aria-labelledby="title-H">
          {/* Pasek podsumowania kontekstu */}
          <div className="bg-[#FBEFF2] border border-[#E8D5DA] rounded-xl p-2.5 sm:px-4 text-xs font-semibold text-[#83223A] flex items-center justify-between gap-2 mb-4 w-full">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Szukasz:</span>
              <strong id="bar-summary-text">
                {selectedCategory ? CATEGORY_NAMES[selectedCategory] : ''} •{' '}
                {selectedOccasion ? (selectedOccasion === 'other' && customOccasion ? customOccasion : OCCASION_NAMES[selectedOccasion]) : ''} •{' '}
                {selectedStyles.length > 0 ? selectedStyles.map((s) => STYLE_NAMES[s]).join(', ') : 'Dopasowany do okazji'}
              </strong>
            </div>
            <button type="button" className="text-[#83223A] underline text-[11.5px] font-bold p-1 cursor-pointer" onClick={() => handleEditChoices('B')}>
              Zmień moje wybory
            </button>
          </div>

          <div className="text-center max-w-[680px] mx-auto mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-[#242220] tracking-tight" id="title-H">
              Fasony, które mogą dobrze współgrać z Twoimi proporcjami i okazją
            </h2>
            <p className="text-[13px] text-[#6B645C] mt-1.5 leading-relaxed">
              Potraktuj je jako inspirację i wybierz te, w których czujesz się najlepiej.
            </p>
          </div>

          {/* Karty rekomendacji */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5 w-full" id="recs-grid-container">
            {displayRecommendationCards.map((card) => (
              <div key={card.id} className="bg-white border border-[#EAE3D9] rounded-2xl overflow-hidden flex flex-col shadow-xs">
                <div className="h-[170px] bg-gradient-to-b from-[#FAF4EF] to-[#F1E5DA] border-b border-[#EAE3D9] flex items-center justify-center relative">
                  <svg width="100" height="140" viewBox="0 0 140 186" fill="none" aria-hidden="true" focusable="false">
                    <ellipse cx="70" cy="18" rx="8" ry="11" fill="#E8DDD3" />
                    <path d="M52 38L70 82L88 38H94L88 160H52L46 38H52Z" fill="#83223A" />
                  </svg>
                </div>
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <h3 className="text-[15px] font-bold text-[#242220]">{card.title}</h3>
                  <p className="text-[12.5px] text-[#6B645C] leading-relaxed">{card.reason}</p>
                  <div className="flex gap-1.5 flex-wrap my-1">
                    {card.badges.map((b, i) => (
                      <span key={i} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA]">
                        {b}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto bg-[#FAF7F2] border border-[#EAE3D9] rounded-lg p-2 text-[11.5px] text-[#242220]">
                    <strong className="text-[#83223A] block text-[10.5px] uppercase tracking-wider mb-0.5">Na co warto zwrócić uwagę</strong>
                    {card.tip}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 max-w-[420px] mx-auto mt-3 w-full">
            <button
              type="button"
              className="btn-cta"
              id="cta-view-H"
              onClick={handleViewProducts}
            >
              {productLoadStatus === 'loading' ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Wyszukuję propozycje ubrań...</span>
                </>
              ) : (
                'Zobacz propozycje ubrań'
              )}
            </button>
            <button type="button" className="btn-secondary" onClick={openResetModal}>
              Zacznij od nowa
            </button>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK I — PRODUKTY Z BAZY (BEZ DANYCH DEMO!)              */}
      {/* ========================================================= */}
      {currentView === 'I' && (
        <section className="view-card wide-layout" id="view-I" aria-labelledby="title-I">
          <div className="bg-[#FBEFF2] border border-[#E8D5DA] rounded-xl p-2.5 sm:px-4 text-xs font-semibold text-[#83223A] flex items-center justify-between gap-2 mb-4 w-full">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Kontekst:</span>
              <strong id="bar-summary-text-I">
                {selectedCategory ? CATEGORY_NAMES[selectedCategory] : ''} •{' '}
                {selectedOccasion ? (selectedOccasion === 'other' && customOccasion ? customOccasion : OCCASION_NAMES[selectedOccasion]) : ''}
              </strong>
            </div>
            <button type="button" className="text-[#83223A] underline text-[11.5px] font-bold p-1 cursor-pointer" onClick={() => showView('H')}>
              Wróć do fasonów
            </button>
          </div>

          <div className="text-center max-w-[680px] mx-auto mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-[#242220] tracking-tight" id="title-I">
              Propozycje ubrań odpowiadające fasonom
            </h2>
            <p className="text-[13px] text-[#6B645C] mt-1.5 leading-relaxed">
              Przejrzyj propozycje ubrań dopasowane do Twojej kategorii i stylu.
            </p>
          </div>

          {/* Błąd lub wynik przymiarki VTON */}
          {tryOnError && (
            <div role="alert" className="w-full bg-[#FDF2F4] border border-[#F3CAD2] text-[#9E1C38] rounded-xl p-3 text-xs mb-4 text-center">
              {tryOnError}
            </div>
          )}

          {tryOnImage && (
            <div className="w-full bg-[#EFF8F3] border border-[#C8E8D5] rounded-2xl p-4 mb-6 flex flex-col items-center gap-3">
              <div className="text-xs font-bold text-[#1E663B] uppercase tracking-wider">✨ Wynik wirtualnej przymiarki</div>
              <img src={tryOnImage} alt="Wirtualna przymiarka" className="max-h-[360px] rounded-xl object-contain shadow-md" />
              <button
                type="button"
                className="text-xs text-[#1E663B] font-semibold underline cursor-pointer"
                onClick={() => setTryOnImage(null)}
              >
                Zamknij podgląd przymiarki
              </button>
            </div>
          )}

          {/* Siatka produktów rzeczywistych */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-4 w-full" id="products-grid-container">
            {products.map((product) => {
              const canTryOn = hasVerifiedTryOnAsset(product) && isValidVtonCategory(analysisResult?.replicateCategory);
              return (
                <div key={product.id} className="bg-white border border-[#EAE3D9] rounded-xl overflow-hidden flex flex-col shadow-xs">
                  <div className="aspect-[3/4] max-h-[240px] bg-[#F4EFEB] border-b border-[#EAE3D9] flex items-center justify-center overflow-hidden relative">
                    {product.heroImage?.url ? (
                      <img
                        src={product.heroImage.url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-2xl text-[#8F867D]">👗</div>
                    )}
                  </div>
                  <div className="p-3.5 flex flex-col flex-1 justify-between gap-2">
                    <div>
                      {product.brand && (
                        <span className="text-[11px] font-semibold text-[#8F867D] uppercase tracking-wider block">
                          {product.brand}
                        </span>
                      )}
                      <h3 className="text-[13.5px] font-bold text-[#242220] leading-snug line-clamp-2">
                        {product.title}
                      </h3>
                      {product.price && (
                        <div className="text-sm font-bold text-[#242220] mt-1">
                          {product.price.amount} {product.price.currency}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <a
                        href={product.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-h-[42px] bg-white border border-[#D5CCC0] text-[#242220] rounded-lg text-xs font-semibold inline-flex items-center justify-center hover:bg-[#FAF7F2] transition-colors"
                      >
                        Przejdź do oferty
                      </a>
                      {canTryOn && (
                        <button
                          type="button"
                          disabled={isTryOnLoading}
                          onClick={() => handleTryOn(product)}
                          className="flex-1 min-h-[42px] bg-[#83223A] text-white rounded-lg text-[11px] font-semibold inline-flex items-center justify-center hover:bg-[#6D1B2F] transition-colors disabled:opacity-60 text-center leading-tight"
                        >
                          {isTryOnLoading ? <Loader2 className="animate-spin" size={14} /> : 'Przymierz'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2 max-w-[420px] mx-auto mt-4 w-full">
            <button type="button" className="btn-secondary" onClick={() => showView('H')}>
              Wróć do rekomendacji fasonów
            </button>
            <button type="button" className="btn-text-back" onClick={openResetModal}>
              Zacznij od nowa
            </button>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK J1 — BŁĄD ZDJĘCIA                                   */}
      {/* ========================================================= */}
      {currentView === 'J1' && (
        <section className="view-card" id="view-J1" aria-labelledby="title-J1">
          <div className="w-[52px] h-[52px] rounded-full bg-[#FEF7EE] border border-[#F7DDBE] text-[#92540D] flex items-center justify-center text-2xl mx-auto mb-3">
            📷
          </div>
          <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-J1">
            Potrzebujemy wyraźniejszego zdjęcia
          </h2>
          <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
            Na przesłanym zdjęciu kontur sylwetki był zbyt mało widoczny lub postać znajdowała się zbyt daleko.
          </p>
          <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3.5 my-4">
            <div className="text-[12.5px] font-bold text-[#242220] mb-1.5">Co możesz zrobić:</div>
            <ul className="text-xs text-[#6B645C] list-disc pl-4.5 space-y-1 leading-relaxed">
              <li>Stań bliżej obiektywu w równym świetle dziennym</li>
              <li>Upewnij się, że w kadrze mieści się cała sylwetka</li>
              <li>Twoje wcześniejsze wybory kategorii i stylu zostały zachowane</li>
            </ul>
          </div>
          <button type="button" className="btn-cta" onClick={() => showView('F')}>
            Wybierz inne zdjęcie
          </button>
          <button type="button" className="btn-secondary" onClick={() => showView('E')}>
            Zobacz wskazówki do zdjęcia
          </button>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK J2 — BŁĄD USŁUGI (BEZ FAŁSZYWYCH OBIETNIC)          */}
      {/* ========================================================= */}
      {currentView === 'J2' && (
        <section className="view-card" id="view-J2" aria-labelledby="title-J2">
          <div className="w-[52px] h-[52px] rounded-full bg-[#FDF2F4] border border-[#F3CAD2] text-[#9E1C38] flex items-center justify-center text-2xl mx-auto mb-3">
            🔌
          </div>
          <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-J2">
            Nie udało się teraz przygotować rekomendacji
          </h2>
          <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
            Nie udało się teraz dokończyć analizy. Możesz spróbować ponownie albo wrócić do poprzedniego kroku.
          </p>
          <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3.5 my-4">
            <div className="text-[12.5px] font-bold text-[#242220] mb-1.5">Zalecane działanie:</div>
            <ul className="text-xs text-[#6B645C] list-disc pl-4.5 space-y-1 leading-relaxed">
              <li>Kliknij poniższy przycisk, aby ponowić próbę</li>
              <li>Sprawdź, czy Twoje połączenie z internetem jest aktywne</li>
              <li>Możesz wrócić do formularza i skorygować wybrane parametry</li>
            </ul>
          </div>
          <button type="button" className="btn-cta" onClick={handleStartAnalysis}>
            Ponów próbę
          </button>
          <button type="button" className="btn-secondary" onClick={() => showView('F')}>
            Wróć do wyboru zdjęcia
          </button>
        </section>
      )}

      {/* ========================================================= */}
      {/* WIDOK J3 — BRAK PRODUKTÓW                                 */}
      {/* ========================================================= */}
      {currentView === 'J3' && (
        <section className="view-card" id="view-J3" aria-labelledby="title-J3">
          <div className="w-[52px] h-[52px] rounded-full bg-[#FEF7EE] border border-[#F7DDBE] text-[#92540D] flex items-center justify-center text-2xl mx-auto mb-3">
            🔍
          </div>
          <h2 className="text-xl font-bold text-[#242220] tracking-tight text-center" id="title-J3">
            Nie znaleźliśmy teraz pasujących propozycji
          </h2>
          <p className="text-[13px] text-[#6B645C] mt-1.5 text-center leading-relaxed">
            Rekomendacje fasonów są gotowe, ale nie znaleźliśmy obecnie ubrań spełniających wszystkie wybrane filtry.
          </p>
          <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3.5 my-4">
            <div className="text-[12.5px] font-bold text-[#242220] mb-1.5">Możliwe opcje:</div>
            <ul className="text-xs text-[#6B645C] list-disc pl-4.5 space-y-1 leading-relaxed">
              <li>Możesz zmienić okazję lub styl, aby poszerzyć kryteria wyszukiwania</li>
              <li>Wróć do rekomendacji krojów i poszukaj podobnych modeli w swoich ulubionych sklepach</li>
            </ul>
          </div>
          <button type="button" className="btn-cta" onClick={() => showView('C')}>
            Zmień okazję lub styl
          </button>
          <button type="button" className="btn-secondary" onClick={() => showView('H')}>
            Wróć do rekomendacji fasonów
          </button>
        </section>
      )}

      {/* ========================================================= */}
      {/* MODAL RESETU SESJI (Dostępny z klawiatury, Focus Trap)   */}
      {/* ========================================================= */}
      {isResetModalOpen && (
        <div
          className="fixed inset-0 bg-[#242220]/60 flex items-center justify-center z-50 p-4"
          id="reset-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reset-title"
          onKeyDown={handleModalKeydown}
        >
          <div className="bg-white rounded-2xl p-6 max-w-[400px] w-full shadow-lg text-center">
            <h3 className="text-[17px] font-bold text-[#242220] mb-2" id="modal-reset-title">
              Rozpocząć od nowa?
            </h3>
            <p className="text-[13px] text-[#6B645C] leading-relaxed">
              Spowoduje to wyczyszczenie wybranego zdjęcia, kategorii, stylu oraz przygotowanych rekomendacji.
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                ref={resetModalCancelBtnRef}
                type="button"
                className="btn-secondary mt-0"
                id="modal-cancel-btn"
                onClick={closeResetModal}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="btn-cta mt-0 bg-[#83223A]"
                id="modal-confirm-btn"
                onClick={resetStudio}
              >
                Wyczyść i zacznij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
