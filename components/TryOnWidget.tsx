'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { authenticatedFetch, AuthenticationRequiredError } from '@/lib/auth-fetch';
import { CanonicalProduct, hasVerifiedTryOnAsset } from '@/types/product';
import { useMarket } from './MarketContext';
import { Loader2 } from 'lucide-react';

export type StudioView = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G1' | 'G2' | 'G3';

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
  bodyShape: string;
  strength: string;
  advice: string;
  avoid: string;
  garmentDetails?: {
    color?: string;
    garmentType?: string;
    cut?: string;
    occasion?: string;
  };
  replicateCategory?: string;
  replicatePrompt?: string;
}

interface StyleRecommendation {
  id: string;
  title: string;
  badges: string[];
  tip: string;
  illustration: 'wrap' | 'skirt' | 'vneck';
}

const getRecommendations = (
  shape: string,
  garmentDetails?: AnalysisResult['garmentDetails']
): StyleRecommendation[] => {
  const normalizedShape = shape ? shape.toUpperCase().trim() : 'NIEZNANA';

  switch (normalizedShape) {
    case 'JABŁKO':
      return [
        {
          id: 'apple-empire',
          title: 'Fason empire lub odcięcie pod biustem',
          badges: ['✨ Swoboda w talii', '✨ Miękka linia bioder'],
          tip: 'Wybieraj zwiewne, płynnie układające się tkaniny.',
          illustration: 'wrap',
        },
        {
          id: 'apple-vneck',
          title: 'Top lub sukienka z dekoltem V',
          badges: ['✨ Wysmuklenie szyi', '✨ Otwarta linia dekoltu'],
          tip: 'Optycznie wydłuża sylwetkę i dodaje lekkości stylizacji.',
          illustration: 'vneck',
        },
        {
          id: 'apple-layer',
          title: 'Prosta, miękko układająca się warstwa',
          badges: ['✨ Pionowe linie', '✨ Płynny ruch tkaniny'],
          tip: 'Dłuższa narzutka lub kardigan tworzy harmonijną, spójną całość.',
          illustration: 'skirt',
        },
      ];

    case 'GRUSZKA':
      return [
        {
          id: 'pear-skirt-a',
          title: 'Spódnica lub sukienka o linii A',
          badges: ['✨ Podkreśla talię', '✨ Swoboda w biodrach'],
          tip: 'Długość midi lub do kolana pięknie równoważy proporcje dolnej części ciała.',
          illustration: 'skirt',
        },
        {
          id: 'pear-shoulder',
          title: 'Góra z detalem przy ramionach',
          badges: ['✨ Balans proporcji', '✨ Wyrazista linia ramion'],
          tip: 'Łódkowy dekolt lub ozdobne rękawy optycznie harmonizują linię bioder.',
          illustration: 'vneck',
        },
        {
          id: 'pear-waist',
          title: 'Fason podkreślający talię',
          badges: ['✨ Zaznaczona talia', '✨ Kobiecy zarys'],
          tip: 'Pasek lub dopasowana góra eksponuje naturalne atuty sylwetki.',
          illustration: 'wrap',
        },
      ];

    case 'KLEPSYDRA':
      return [
        {
          id: 'hourglass-wrap',
          title: 'Sukienka lub bluzka kopertowa',
          badges: ['✨ Akcentuje wcięcie w talii', '✨ Naturalny dekolt V'],
          tip: 'Wybieraj miękko układające się tkaniny, które otulają linię bioder.',
          illustration: 'wrap',
        },
        {
          id: 'hourglass-waist',
          title: 'Fason z zaznaczoną talią',
          badges: ['✨ Proporcjonalny krój', '✨ Harmonijny zarys'],
          tip: 'Kroje dopasowane w pasie subtelnie podkreślają naturalną symetrię.',
          illustration: 'skirt',
        },
        {
          id: 'hourglass-vneck',
          title: 'Dekolt V lub łagodny dekolt',
          badges: ['✨ Wysmuklenie szyi', '✨ Subtelny akcent'],
          tip: 'Świetnie sprawdza się w stylizacjach codziennych i eleganckich.',
          illustration: 'vneck',
        },
      ];

    case 'KOLUMNA':
      return [
        {
          id: 'column-belt',
          title: 'Fason z paskiem lub zaznaczoną talią',
          badges: ['✨ Wyraźniejszy zarys talii', '✨ Modelowanie proporcji'],
          tip: 'Pasek lub marszczenie w talii dodaje sylwetce plastyczności.',
          illustration: 'wrap',
        },
        {
          id: 'column-top',
          title: 'Warstwowy lub strukturalny top',
          badges: ['✨ Trójwymiarowa forma', '✨ Ciekawe faktury'],
          tip: 'Plisy, żakard lub geometryczne przeszycia nadają stylizacji głębi.',
          illustration: 'vneck',
        },
        {
          id: 'column-skirt-a',
          title: 'Spódnica lub sukienka o linii A',
          badges: ['✨ Rozszerzany dół', '✨ Ruch i lekkość'],
          tip: 'Krój rozkloszowany nadaje sylwetce łagodnych, kobiecych konturów.',
          illustration: 'skirt',
        },
      ];

    case 'ROŻEK':
      return [
        {
          id: 'cone-skirt-a',
          title: 'Spódnica lub sukienka o linii A',
          badges: ['✨ Dodaje objętości dołowi', '✨ Równoważy ramiona'],
          tip: 'Rozszerzany dół tworzy pożądaną równowagę z linią ramion.',
          illustration: 'skirt',
        },
        {
          id: 'cone-pants',
          title: 'Spodnie o szerszej nogawce',
          badges: ['✨ Swobodny krok', '✨ Balans linii bioder'],
          tip: 'Fasony z prostą lub szerszą nogawką harmonizują proporcje sylwetki.',
          illustration: 'wrap',
        },
        {
          id: 'cone-vneck',
          title: 'Prosta góra z dekoltem V',
          badges: ['✨ Wysmukla linię ramion', '✨ Pionowy podział'],
          tip: 'Gładkie, jednolite bluzki z dekoltem w szpic łagodzą linię barków.',
          illustration: 'vneck',
        },
      ];

    case 'NIEZNANA':
    default: {
      const recs: StyleRecommendation[] = [];
      const itemTitle1 = garmentDetails?.garmentType
        ? `Fason: ${garmentDetails.garmentType}`
        : 'Uniwersalny fason o prostych liniach';
      const itemTitle2 = garmentDetails?.cut
        ? `Krój: ${garmentDetails.cut}`
        : 'Lekko taliowana linia';

      recs.push({
        id: 'neutral-1',
        title: itemTitle1,
        badges: ['✨ Ponadczasowy krój', '✨ Wygoda noszenia'],
        tip: 'Klasyczny krój sprawdzający się w różnorodnych zestawieniach.',
        illustration: 'vneck',
      });

      recs.push({
        id: 'neutral-2',
        title: itemTitle2,
        badges: ['✨ Naturalne ułożenie', '✨ Swoboda ruchów'],
        tip: 'Dopasuj proporcje do swoich indywidualnych upodobań i stylu.',
        illustration: 'skirt',
      });

      return recs;
    }
  }
};

export default function TryOnWidget() {
  const { market } = useMarket();

  // Aktywny widok maszyny stanów (domyślnie 'A')
  const [currentView, setCurrentView] = useState<StudioView>('A');

  // Stan autoryzacji Firebase
  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Stan wgranego pliku
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [personBase64, setPersonBase64] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Stan analizy i wyników
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // Stan produktów
  const [products, setProducts] = useState<CanonicalProduct[]>([]);
  const [productLoadStatus, setProductLoadStatus] = useState<ProductLoadStatus>('idle');

  // Mutex VTON
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);
  const [isAppProcessing, setIsAppProcessing] = useState(false);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  // Referencje
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevUserUidRef = useRef<string | null>(null);

  // Liczniki generacji do ochrony przed wyścigami asynchronicznymi
  const imageProcessingGenerationRef = useRef(0);
  const studioGenerationRef = useRef(0);
  const analysisInFlightRef = useRef(false);

  // Kontrolery AbortController dla poszczególnych operacji
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const productsAbortControllerRef = useRef<AbortController | null>(null);
  const tryOnAbortControllerRef = useRef<AbortController | null>(null);

  // Funkcja całkowitego resetowania stanu Studio
  const resetStudio = () => {
    // 1. Inkrementacja generacji i natychmiastowe zwolnienie mutexu analizy
    studioGenerationRef.current += 1;
    imageProcessingGenerationRef.current += 1;
    analysisInFlightRef.current = false;

    // 2. Anulowanie wszystkich trwających żądań sieciowych
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

    // 3. Czyszczenie zasobów DOM i pamięci
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setPersonBase64(null);
    setConsentChecked(false);
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
    setCurrentView('A');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Nasłuchiwanie autoryzacji Firebase z czyszczeniem po wylogowaniu
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const prevUid = prevUserUidRef.current;
      const currentUid = currentUser ? currentUser.uid : null;

      // Wykryj rzeczywiste przejście: zalogowany -> brak użytkownika lub zmiana UID
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

  // Obsługa wyboru pliku z natychmiastowym czyszczeniem Base64, walidacją i licznikiem generacji
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Walidacja typu MIME
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      imageProcessingGenerationRef.current += 1;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setPersonBase64(null);
      setIsImageProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFileError('Wybierz zdjęcie JPG, PNG lub WEBP.');
      return;
    }

    // 2. Walidacja rozmiaru (maksymalnie 10 MiB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      imageProcessingGenerationRef.current += 1;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setPersonBase64(null);
      setIsImageProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFileError('Zdjęcie może mieć maksymalnie 10 MB.');
      return;
    }

    // 3. Po pozytywnej walidacji MIME i rozmiaru – natychmiastowe czyszczenie starego obrazu i powiązanych danych
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

    // 4. Inkrementacja generacji przetwarzania obrazu
    const generation = ++imageProcessingGenerationRef.current;

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setIsImageProcessing(true);

    try {
      const base64 = await processImage(file);
      // Ochrona przed wyścigiem: jeśli w międzyczasie rozpoczęto nowsze przetwarzanie, ignoruj
      if (generation !== imageProcessingGenerationRef.current) return;
      setPersonBase64(base64);
    } catch (err) {
      console.error('Error processing image:', err);
      if (generation !== imageProcessingGenerationRef.current) return;
      setSelectedFile(null);
      setPersonBase64(null);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFileError('Nie udało się przetworzyć wybranego zdjęcia.');
      showView('G1');
    } finally {
      if (generation === imageProcessingGenerationRef.current) {
        setIsImageProcessing(false);
      }
    }
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
    // 1. Synchroniczny mutex przed jakimkolwiek await
    if (analysisInFlightRef.current) return;
    if (isAnalysisLoading) return;
    if (!selectedFile || !personBase64 || !consentChecked || isImageProcessing) return;

    analysisInFlightRef.current = true;
    setIsAnalysisLoading(true);

    const sessionGen = studioGenerationRef.current;

    // Anuluj ewentualne poprzednie żądanie analizy
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
          // Użytkowniczka zamknęła okno logowania
          return;
        }
      }

      // Przejście do widoku oczekiwania D
      if (sessionGen !== studioGenerationRef.current) return;
      showView('D');

      const response = await authenticatedFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          image: personBase64,
          query: 'fasony sylwetki',
        }),
      });

      if (sessionGen !== studioGenerationRef.current) return;

      const data = await response.json();
      if (sessionGen !== studioGenerationRef.current) return;

      if (!response.ok) {
        if (response.status === 400 || (data.error && data.error.includes('IMAGE'))) {
          showView('G1');
          return;
        }
        showView('G2');
        return;
      }

      const result: AnalysisResult = {
        strength: data.strength || 'Twoja sylwetka ma doskonałe, naturalne proporcje.',
        advice: data.advice || 'Wybieraj kroje akcentujące talię i miękko opływające linię bioder.',
        avoid: data.avoid || 'Unikaj zbyt sztywnych materiałów o prostym, pudełkowym kroju.',
        uiTitle: data.uiTitle || 'Rekomendacje fasonów',
        apiQuery: data.apiQuery || 'sukienka kopertowa',
        stylistComment: data.stylistComment,
        bodyShape: data.bodyShape || 'NIEZNANA',
        garmentDetails: data.garmentDetails,
        replicateCategory: data.replicateCategory || 'upper_body',
        replicatePrompt: data.replicatePrompt || '',
      };

      setAnalysisResult(result);

      // Pobranie produktów w tle dla widoku F
      fetchProductsForView(result.apiQuery, false);

      // Przejście do widoku rekomendacji krojów E
      showView('E');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Kontrolowane przerwanie: nie prowadzi do błędu G2
        return;
      }
      if (sessionGen !== studioGenerationRef.current) return;
      console.error('Analysis failed:', err);
      if (err instanceof AuthenticationRequiredError) {
        showView('C');
      } else {
        showView('G2');
      }
    } finally {
      if (sessionGen === studioGenerationRef.current) {
        analysisInFlightRef.current = false;
        setIsAnalysisLoading(false);
      }
    }
  };

  // Pobranie produktów z API z obsługą statusu ProductLoadStatus, AbortController i generacji
  const fetchProductsForView = async (query: string, navigateOnFinish = false) => {
    const sessionGen = studioGenerationRef.current;

    // Anuluj poprzednie żądanie pobierania produktów
    if (productsAbortControllerRef.current) {
      productsAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    productsAbortControllerRef.current = abortController;

    setProductLoadStatus('loading');
    setProducts([]);

    try {
      const url = `/api/products?q=${encodeURIComponent(query)}&market=${encodeURIComponent(market.marketCode)}`;
      const response = await authenticatedFetch(url, {
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
          showView('F');
        }
      } else {
        setProducts([]);
        setProductLoadStatus('empty');
        if (navigateOnFinish) {
          showView('G3');
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        // Kontrolowane przerwanie: brak efektu ubocznego
        return;
      }
      if (sessionGen !== studioGenerationRef.current) return;
      console.warn('Failed to fetch products:', e);
      setProductLoadStatus('error');
    }
  };

  // Obsługa przycisku przejścia do produktów na ekranie E
  const handleViewProducts = () => {
    if (productLoadStatus === 'ready') {
      showView('F');
    } else if (productLoadStatus === 'empty') {
      showView('G3');
    } else if (productLoadStatus === 'idle') {
      if (analysisResult?.apiQuery) {
        fetchProductsForView(analysisResult.apiQuery, true);
      }
    }
  };

  // Obsługa wirtualnej przymiarki VTON – bez fallbacku, z ochroną generacyjną i AbortController
  const handleTryOn = async (product: CanonicalProduct) => {
    if (!personBase64 || isAppProcessing || isTryOnLoading) return;

    if (!hasVerifiedTryOnAsset(product)) {
      setTryOnError('Ten produkt nie jest obecnie dostępny do wirtualnej przymiarki.');
      return;
    }

    const clothingImageUrl = product.tryOnAsset?.image?.url;
    const clothingTitle = product.title;

    if (!clothingImageUrl || !clothingTitle || !clothingImageUrl.trim() || !clothingTitle.trim()) {
      setTryOnError('Ten produkt nie jest obecnie dostępny do wirtualnej przymiarki.');
      return;
    }

    const sessionGen = studioGenerationRef.current;

    // Anuluj poprzednie żądanie VTON
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

    let bodyModifier = analysisResult?.advice ? ` ${analysisResult.advice}` : '';
    const shape = analysisResult?.bodyShape;
    if (shape === 'JABŁKO') bodyModifier += ' +empire +maskująca talia +luźny obrys ciała';
    else if (shape === 'GRUSZKA') bodyModifier += ' +rozkloszowana +balans biodra +podkreślona góra z wcięciem';
    else if (shape === 'KLEPSYDRA') bodyModifier += ' +dopasowana +podkreśla talię +sylwetka opięta';
    else if (shape === 'KOLUMNA') bodyModifier += ' +warstwowa +objętość +struktura geometryczna';
    else if (shape === 'ROŻEK') bodyModifier += ' +rozkloszowana dół +uwypukla biodra';

    const replicateCategory = analysisResult?.replicateCategory || 'upper_body';
    const replicatePrompt = analysisResult?.replicatePrompt || '';
    const clientRequestId = crypto.randomUUID();

    try {
      const response = await authenticatedFetch('/api/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          requestId: clientRequestId,
          personImage: personBase64,
          clothingImage: clothingImageUrl,
          category: replicateCategory,
          replicatePrompt: replicatePrompt,
          productTitle: clothingTitle,
          bodyTypeModifier: bodyModifier,
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

  const isWideLayout = currentView === 'E' || currentView === 'F';

  // Rekomendacje krojów wyliczone deterministycznie na podstawie bodyShape
  const recommendations = analysisResult
    ? getRecommendations(analysisResult.bodyShape, analysisResult.garmentDetails)
    : [];

  // Bezpieczny nagłówek i opis (bez słowa "Unikaj")
  const safeStrength =
    analysisResult?.strength && !analysisResult.strength.toLowerCase().startsWith('unikaj')
      ? analysisResult.strength
      : 'Twoje proporcje dobrze współgrają z dobranymi fasonami';

  const safeAdvice =
    analysisResult?.advice && !analysisResult.advice.toLowerCase().startsWith('unikaj')
      ? analysisResult.advice
      : 'Na podstawie widocznych proporcji przygotowaliśmy propozycje krojów. Wybierz te, w których czujesz się najbardziej komfortowo.';

  return (
    <div className="w-full flex flex-col items-center">
      {/* Główny kontener widoku */}
      <div
        className={`w-full mx-auto px-4 py-6 transition-all duration-300 ${
          isWideLayout ? 'max-w-[1040px]' : 'max-w-[480px]'
        }`}
      >
        {/* ========================================================= */}
        {/* Ekran startowy Studio                                     */}
        {/* ========================================================= */}
        {currentView === 'A' && (
          <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 shadow-xs flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-1.5 bg-[#FBEFF2] border border-[#E8D5DA] text-[#83223A] text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <span>✨</span> Analiza sylwetki i fasonów
            </div>
            <h1 className="text-xl font-bold text-[#242220] tracking-tight">
              Odkryj fasony dopasowane do Twojej figury
            </h1>
            <p className="text-[#6B645C] text-sm mt-2 max-w-[380px] leading-relaxed">
              Wgraj jedno zdjęcie sylwetki. Sztuczna inteligencja przeanalizuje proporcje i wskaże kroje ubrań, które najlepiej podkreślają Twoje naturalne atuty.
            </p>

            <div className="w-full bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3.5 my-5 text-left flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5 text-xs text-[#242220]">
                <span className="w-5 h-5 rounded-full bg-[#83223A]/10 text-[#83223A] font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>Jedno zdjęcie całej sylwetki w naturalnej pozie</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[#242220]">
                <span className="w-5 h-5 rounded-full bg-[#83223A]/10 text-[#83223A] font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>Konkretne rekomendacje krojów z uzasadnieniem</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[#242220]">
                <span className="w-5 h-5 rounded-full bg-[#83223A]/10 text-[#83223A] font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <span>Propozycje ubrań odpowiadające fasonom</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => showView('B')}
              className="w-full min-h-[48px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center"
            >
              Rozpocznij analizę sylwetki
            </button>
            <p className="text-[11.5px] text-[#8F867D] mt-3">
              Zdjęcie zostanie użyte do przygotowania analizy sylwetki. Szczegóły przetwarzania znajdziesz w Polityce prywatności.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* Instrukcja przygotowania zdjęcia                          */}
        {/* ========================================================= */}
        {currentView === 'B' && (
          <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 shadow-xs flex flex-col">
            <h2 className="text-[17px] font-bold text-[#242220] tracking-tight">
              Jak przygotować dobre zdjęcie?
            </h2>
            <p className="text-[#6B645C] text-xs mt-1">
              Im lepiej widoczne są proporcje sylwetki, tym trafniejsze będą rekomendacje.
            </p>

            <div className="flex flex-col gap-3 my-4">
              <div className="border border-[#EAE3D9] rounded-xl p-3 bg-[#FAF7F2] flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#242220]">Cała postać w kadrze</h4>
                  <p className="text-[11.5px] text-[#6B645C] mt-0.5 leading-snug">
                    Stań prosto, przodem do aparatu, tak aby widoczne były ramiona, talia i biodra.
                  </p>
                </div>
              </div>

              <div className="border border-[#EAE3D9] rounded-xl p-3 bg-[#FAF7F2] flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#242220]">Dobre oświetlenie</h4>
                  <p className="text-[11.5px] text-[#6B645C] mt-0.5 leading-snug">
                    Najlepiej sprawdza się światło dzienne bez mocnych cieni z boku.
                  </p>
                </div>
              </div>

              <div className="border border-[#EAE3D9] rounded-xl p-3 bg-[#FAF7F2] flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#242220]">Ubranie przylegające</h4>
                  <p className="text-[11.5px] text-[#6B645C] mt-0.5 leading-snug">
                    Unikaj obszernych kurtek i puchowych płaszczy maskujących naturalne proporcje.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => showView('C')}
              className="w-full min-h-[48px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center"
            >
              Przejdź do wyboru zdjęcia
            </button>
            <button
              type="button"
              onClick={() => showView('A')}
              className="w-full text-xs text-[#8F867D] hover:text-[#242220] mt-3 py-1 font-medium transition-colors"
            >
              Wróć do ekranu startowego
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* WIDOK C: Wgranie i zgoda                                  */}
        {/* ========================================================= */}
        {currentView === 'C' && (
          <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 shadow-xs flex flex-col">
            <h2 className="text-[17px] font-bold text-[#242220] tracking-tight">
              Wgraj zdjęcie sylwetki
            </h2>
            <p className="text-[#6B645C] text-xs mt-1">
              Wybierz plik ze swojego urządzenia (JPG, PNG lub WEBP, do 10 MB).
            </p>

            {/* Obszar wyboru pliku w formie dostępnego label */}
            <div className="my-4">
              <label
                htmlFor="studio-photo-input"
                className="w-full min-h-[220px] border-2 border-dashed border-[#D5CCC0] hover:border-[#83223A] bg-[#FAF7F2] rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors relative"
              >
                <input
                  ref={fileInputRef}
                  id="studio-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                {previewUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={previewUrl}
                      alt="Podgląd wybranego zdjęcia"
                      className="max-h-[160px] rounded-xl object-contain shadow-xs"
                    />
                    <span className="text-xs font-semibold text-[#83223A] mt-1">
                      Zmień wybrane zdjęcie
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-full bg-[#FBEFF2] text-[#83223A] flex items-center justify-center text-xl mb-1"
                      aria-hidden="true"
                    >
                      📷
                    </div>
                    <span className="text-xs font-bold text-[#242220]">
                      Kliknij, aby wybrać zdjęcie
                    </span>
                    <span className="text-[11px] text-[#8F867D]">
                      JPG, PNG, WEBP (maks. 10 MB)
                    </span>
                  </div>
                )}
              </label>

              {/* Komunikat o błędzie pliku */}
              {fileError && (
                <div role="alert" className="mt-2 p-2.5 bg-[#FDF2F4] border border-[#F3CAD2] rounded-xl text-left">
                  <p className="text-xs text-[#9E1C38] font-medium leading-snug">
                    {fileError}
                  </p>
                </div>
              )}

              {/* Loader przetwarzania zdjęcia w pamięci */}
              {isImageProcessing && (
                <div role="status" aria-live="polite" className="mt-2 flex items-center justify-center gap-2 text-xs text-[#83223A]">
                  <Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true" focusable="false" />
                  <span>Optymalizacja zdjęcia...</span>
                </div>
              )}
            </div>

            {/* Checkbox zgody */}
            <div className="flex items-start gap-2.5 mt-2 bg-[#FAF7F2] border border-[#EAE3D9] p-3 rounded-xl">
              <input
                type="checkbox"
                id="consentCheckbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="w-5 h-5 accent-[#83223A] mt-0.5 shrink-0 cursor-pointer"
              />
              <label htmlFor="consentCheckbox" className="text-[11.5px] text-[#242220] leading-snug cursor-pointer">
                Wyrażam zgodę na przesłanie zdjęcia do usługi Google Gemini w celu jednorazowej analizy sylwetki i przygotowania rekomendacji fasonów.
              </label>
            </div>
            <p className="text-[11px] text-[#8F867D] mt-2 px-1 leading-normal">
              Analiza może obejmować cechy widoczne na zdjęciu, takie jak proporcje sylwetki i ułożenie ubrania.
            </p>

            {/* Przycisk CTA: Zaloguj się lub Rozpocznij */}
            <div className="mt-4">
              <button
                type="button"
                id="btnSubmitConsent"
                disabled={
                  !selectedFile ||
                  !personBase64 ||
                  !consentChecked ||
                  isImageProcessing ||
                  isAnalysisLoading ||
                  isSigningIn
                }
                onClick={handleStartAnalysis}
                className="w-full min-h-[48px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center disabled:bg-[#D3CBC4] disabled:text-[#7D756E] disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="animate-spin mr-2 motion-reduce:animate-none" size={18} aria-hidden="true" focusable="false" />
                    Logowanie przez Google...
                  </>
                ) : isAnalysisLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 motion-reduce:animate-none" size={18} aria-hidden="true" focusable="false" />
                    Przygotowywanie analizy...
                  </>
                ) : user ? (
                  'Rozpocznij analizę'
                ) : (
                  'Zaloguj się i rozpocznij analizę'
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => showView('B')}
              className="w-full text-xs text-[#8F867D] hover:text-[#242220] mt-3 py-1 font-medium transition-colors"
            >
              Wróć do instrukcji zdjęcia
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* WIDOK D: Oczekiwanie na wynik                             */}
        {/* ========================================================= */}
        {currentView === 'D' && (
          <div
            role="status"
            aria-live="polite"
            className="bg-white border border-[#EAE3D9] rounded-2xl p-9 text-center shadow-xs flex flex-col items-center"
          >
            <div className="w-14 h-14 rounded-full bg-[#FBEFF2] flex items-center justify-center mb-5 relative">
              <div
                className="w-5 h-5 rounded-full bg-[#83223A] animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-[17px] font-bold text-[#242220] tracking-tight">
              Przygotowujemy Twoje rekomendacje
            </h2>
            <p className="text-[13.5px] text-[#242220] font-medium mt-2.5">
              Analiza może potrwać chwilę. Pozostań na tej stronie.
            </p>
            <p className="text-[12px] text-[#6B645C] max-w-[320px] mt-2">
              Po zakończeniu pokażemy fasony, które mogą dobrze współgrać z Twoją sylwetką.
            </p>
            <span className="sr-only">Trwa analiza sylwetki...</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* WIDOK E: Rekomendacje krojów z dynamiczną mapą fasonów   */}
        {/* ========================================================= */}
        {currentView === 'E' && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#FBEFF2] border border-[#E8D5DA] rounded-xl p-3.5 max-w-[740px] mx-auto w-full">
              <h2 className="text-[16px] font-bold text-[#242220] leading-snug">
                {safeStrength}
              </h2>
              <p className="text-[12px] text-[#242220] mt-1.5 leading-relaxed">
                {safeAdvice}
              </p>
            </div>

            <h3 className="text-[14.5px] font-bold text-[#242220] max-w-[740px] mx-auto w-full">
              Rekomendowane fasony ubrań:
            </h3>

            {/* Dynamiczne karty krojów na podstawie analizy */}
            <div
              className={`grid grid-cols-1 ${
                recommendations.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-[640px] mx-auto'
              } gap-4 mb-4`}
            >
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white border border-[#EAE3D9] rounded-2xl overflow-hidden shadow-xs flex flex-col"
                >
                  <div className="aspect-[3/4] max-h-[230px] w-full bg-gradient-to-b from-[#FAF4EF] to-[#F1E5DA] flex items-center justify-center border-b border-[#EAE3D9]">
                    {rec.illustration === 'wrap' && (
                      <svg
                        width="140"
                        height="186"
                        viewBox="0 0 140 186"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <defs>
                          <linearGradient id={`wrapGrad_${rec.id}`} x1="70" y1="20" x2="70" y2="170" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#9E2A4B" />
                            <stop offset="1" stopColor="#731C32" />
                          </linearGradient>
                          <linearGradient id={`wrapFold_${rec.id}`} x1="40" y1="50" x2="90" y2="100" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#B23558" />
                            <stop offset="1" stopColor="#651428" />
                          </linearGradient>
                          <filter id={`shadowWrap_${rec.id}`} x="20" y="16" width="100" height="160" filterUnits="userSpaceOnUse">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.12" />
                          </filter>
                        </defs>
                        <ellipse cx="70" cy="18" rx="8" ry="11" fill="#E8DDD3" />
                        <path d="M62 28H78L82 38H58L62 28Z" fill="#D9CDC2" />
                        <g filter={`url(#shadowWrap_${rec.id})`}>
                          <path d="M48 38L30 58L40 66L52 50L48 38Z" fill="#88203B" />
                          <path d="M92 38L110 58L100 66L88 50L92 38Z" fill="#88203B" />
                          <path d="M52 38L70 82H88L88 50L92 38H52Z" fill={`url(#wrapGrad_${rec.id})`} />
                          <path d="M88 38L62 82H78L92 38H88Z" fill={`url(#wrapFold_${rec.id})`} />
                          <rect x="52" y="80" width="36" height="7" rx="2" fill="#5C1022" />
                          <path d="M76 84C76 84 84 94 86 108C82 106 78 98 76 84Z" fill="#88203B" />
                          <path d="M52 87L34 165H106L88 87H52Z" fill={`url(#wrapGrad_${rec.id})`} />
                          <path d="M60 87L46 165L68 165L74 87H60Z" fill="#6B162B" opacity="0.4" />
                          <path d="M74 87L78 165L96 165L86 87H74Z" fill="#B23558" opacity="0.25" />
                        </g>
                      </svg>
                    )}

                    {rec.illustration === 'skirt' && (
                      <svg
                        width="140"
                        height="186"
                        viewBox="0 0 140 186"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <defs>
                          <linearGradient id={`skirtGrad_${rec.id}`} x1="70" y1="50" x2="70" y2="165" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#4A5568" />
                            <stop offset="1" stopColor="#2D3748" />
                          </linearGradient>
                          <filter id={`shadowSkirt_${rec.id}`} x="20" y="38" width="100" height="135" filterUnits="userSpaceOnUse">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.12" />
                          </filter>
                        </defs>
                        <ellipse cx="70" cy="18" rx="8" ry="11" fill="#E8DDD3" />
                        <path d="M54 36H86L88 56H52L54 36Z" fill="#D9CDC2" />
                        <g filter={`url(#shadowSkirt_${rec.id})`}>
                          <path d="M50 56H90L88 68H52L50 56Z" fill="#1A202C" />
                          <path d="M52 68L26 162H114L88 68H52Z" fill={`url(#skirtGrad_${rec.id})`} />
                          <path d="M60 68L48 162L58 162L66 68H60Z" fill="#1A202C" opacity="0.3" />
                          <path d="M72 68L68 162L80 162L76 68H72Z" fill="#CBD5E0" opacity="0.15" />
                          <path d="M80 68L92 162L102 162L86 68H80Z" fill="#1A202C" opacity="0.3" />
                        </g>
                      </svg>
                    )}

                    {rec.illustration === 'vneck' && (
                      <svg
                        width="140"
                        height="186"
                        viewBox="0 0 140 186"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <defs>
                          <linearGradient id={`vGrad_${rec.id}`} x1="70" y1="30" x2="70" y2="160" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#C28B59" />
                            <stop offset="1" stopColor="#9C6636" />
                          </linearGradient>
                          <filter id={`shadowV_${rec.id}`} x="20" y="24" width="100" height="145" filterUnits="userSpaceOnUse">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.12" />
                          </filter>
                        </defs>
                        <ellipse cx="70" cy="18" rx="8" ry="11" fill="#E8DDD3" />
                        <path d="M64 26H76V38H64V26Z" fill="#D9CDC2" />
                        <g filter={`url(#shadowV_${rec.id})`}>
                          <path d="M46 36L28 72L38 78L52 50L46 36Z" fill="#8A572B" />
                          <path d="M94 36L112 72L102 78L88 50L94 36Z" fill="#8A572B" />
                          <path d="M48 36L70 76L92 36H94L88 110L52 110L46 36H48Z" fill={`url(#vGrad_${rec.id})`} />
                          <path d="M48 36L70 76L66 76L46 36H48Z" fill="#754720" />
                          <path d="M92 36L70 76L74 76L94 36H92Z" fill="#754720" />
                          <path d="M52 110L48 160H92L88 110H52Z" fill="#8A572B" />
                        </g>
                      </svg>
                    )}
                  </div>
                  <div className="p-3.5 flex flex-col flex-grow justify-between">
                    <div>
                      <h4 className="text-[13.5px] font-bold text-[#242220]">{rec.title}</h4>
                      <div className="flex flex-wrap gap-1.5 my-2">
                        {rec.badges.map((badge, idx) => (
                          <span
                            key={idx}
                            className="bg-[#FAF7F2] border border-[#EAE3D9] text-[#242220] text-[11px] font-medium px-2 py-0.5 rounded-md"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#FBF6F0] border-l-3 border-[#D6A87C] p-2 rounded-r-md text-[11.5px] text-[#242220] leading-snug mt-2">
                      <strong>Wskazówka:</strong>
                      <br />
                      {rec.tip}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Przycisk przejścia do ubrań zależny od stanu ProductLoadStatus */}
            <div className="flex flex-col items-center w-full">
              <button
                type="button"
                onClick={handleViewProducts}
                disabled={productLoadStatus === 'loading'}
                className="w-full md:max-w-[500px] min-h-[48px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center disabled:opacity-60 disabled:cursor-wait"
              >
                {productLoadStatus === 'loading' ? (
                  <>
                    <Loader2 className="animate-spin mr-2 motion-reduce:animate-none" size={18} aria-hidden="true" focusable="false" />
                    Szukamy pasujących ubrań…
                  </>
                ) : (
                  'Zobacz ubrania w tych fasonach'
                )}
              </button>

              {productLoadStatus === 'error' && (
                <div className="mt-3 flex flex-col items-center gap-1.5" role="alert">
                  <p className="text-xs text-[#9E1C38] font-medium">Nie udało się teraz pobrać produktów.</p>
                  <button
                    type="button"
                    onClick={() => analysisResult?.apiQuery && fetchProductsForView(analysisResult.apiQuery, false)}
                    className="text-xs font-semibold text-[#83223A] hover:underline"
                  >
                    Spróbuj pobrać ponownie
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* WIDOK F: Propozycje ubrań (Mobile 1 col, Desktop 2 col)   */}
        {/* ========================================================= */}
        {currentView === 'F' && (
          <div className="flex flex-col gap-4 w-full max-w-[980px] mx-auto">
            <div>
              <h2 className="text-[17px] font-bold text-[#242220] tracking-tight">
                Ubrania w polecanych fasonach
              </h2>
              <p className="text-[#6B645C] text-[12.5px] mt-1">
                Zobacz dostępne propozycje odpowiadające przygotowanym rekomendacjom.
              </p>
            </div>

            {/* Podgląd wyniku VTON jeśli wygenerowano */}
            {isTryOnLoading && (
              <div
                role="status"
                aria-live="polite"
                className="bg-white border border-[#EAE3D9] p-4 rounded-2xl flex items-center justify-center gap-3"
              >
                <Loader2 className="animate-spin text-[#83223A] motion-reduce:animate-none" size={20} aria-hidden="true" focusable="false" />
                <span className="text-xs font-semibold text-[#242220]">
                  Dopasowuję wizualnie fason do Twojego zdjęcia...
                </span>
              </div>
            )}
            {tryOnError && (
              <div role="alert" className="bg-[#FDF2F4] border border-[#F3CAD2] text-[#9E1C38] text-xs p-3 rounded-xl">
                {tryOnError}
              </div>
            )}
            {tryOnImage && (
              <div className="bg-white border border-[#EAE3D9] p-4 rounded-2xl flex flex-col items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#83223A] mb-2">
                  Twój wynik wirtualnej przymiarki (VTON):
                </h4>
                <img
                  src={tryOnImage}
                  alt="Wynik przymiarki"
                  className="max-h-[360px] rounded-xl object-contain shadow-md"
                />
              </div>
            )}

            {/* Siatka produktów z API */}
            {products.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-center">
                {products.map((p) => {
                  const canTryOn = hasVerifiedTryOnAsset(p);
                  const priceObj = p.price;
                  const hasPrice =
                    Boolean(priceObj && typeof priceObj.amount === 'number' && priceObj.amount > 0 && priceObj.currency);
                  const displayPrice = hasPrice && priceObj ? `${priceObj.amount.toFixed(2)} ${priceObj.currency}` : null;
                  const displayMerchant =
                    p.merchant?.name && p.merchant.name.trim().length > 0 ? p.merchant.name : (p.brand || null);
                  const productImgUrl = p.heroImage?.url || null;

                  return (
                    <div
                      key={p.id}
                      className="bg-white border border-[#EAE3D9] rounded-2xl overflow-hidden shadow-xs flex flex-col max-w-[480px] w-full mx-auto"
                    >
                      <div className="aspect-[3/4] bg-[#FAF7F2] w-full relative flex items-center justify-center border-b border-[#EAE3D9] overflow-hidden">
                        {productImgUrl ? (
                          <img
                            src={productImgUrl}
                            alt={p.title || 'Zdjęcie produktu'}
                            className="w-full h-full object-contain p-2"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#8F867D] text-xs">
                            Brak zdjęcia
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-grow justify-between gap-3">
                        <div>
                          {displayMerchant && (
                            <span className="text-[11px] font-semibold text-[#8F867D] block mb-1">
                              {displayMerchant}
                            </span>
                          )}
                          <h4 className="text-[14px] font-bold text-[#242220] line-clamp-2">
                            {p.title}
                          </h4>
                          {displayPrice && (
                            <div className="mt-1.5">
                              <span className="text-[16px] font-bold text-[#242220]">
                                {displayPrice}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {p.productUrl && (
                            <a
                              href={p.productUrl}
                              target="_blank"
                              rel="noopener noreferrer sponsored"
                              className="flex-1 min-h-[42px] bg-white border border-[#D5CCC0] hover:bg-[#FAF7F2] text-[#242220] font-semibold text-[12.5px] rounded-xl transition-all flex items-center justify-center text-center"
                            >
                              Zobacz produkt
                            </a>
                          )}
                          {canTryOn && (
                            <button
                              type="button"
                              onClick={() => handleTryOn(p)}
                              disabled={isAppProcessing || isTryOnLoading || !personBase64}
                              className="flex-1 min-h-[42px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-[12.5px] rounded-xl transition-all shadow-xs active:scale-[0.99] flex items-center justify-center disabled:opacity-50"
                            >
                              Przymierz
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-center mt-3">
              <button
                type="button"
                onClick={() => showView('E')}
                className="w-full md:max-w-[400px] min-h-[44px] bg-white border border-[#D5CCC0] hover:bg-[#FAF7F2] text-[#242220] font-semibold text-sm rounded-xl transition-all flex items-center justify-center"
              >
                Wróć do rekomendacji krojów
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Stan błędu: Wyraźniejsze zdjęcie                          */}
        {/* ========================================================= */}
        {currentView === 'G1' && (
          <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 text-center shadow-xs">
            <div
              className="w-13 h-13 rounded-full bg-[#FEF7EE] text-[#92540D] border border-[#F7DDBE] flex items-center justify-center text-xl mx-auto mb-3.5"
              aria-hidden="true"
            >
              📷
            </div>
            <h2 className="text-[17px] font-bold text-[#242220] tracking-tight">
              Potrzebujemy wyraźniejszego zdjęcia
            </h2>
            <p className="text-[#6B645C] text-[13px] mt-1.5">
              Przesłane zdjęcie było zbyt ciemne lub postać znajdowała się zbyt daleko obiektywu.
            </p>

            <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 text-left my-4">
              <h5 className="text-[12px] font-bold text-[#242220] mb-1.5">Jak przygotować lepsze zdjęcie:</h5>
              <ul className="text-[11.5px] text-[#6B645C] space-y-1 pl-4 list-disc">
                <li>Stań przodem do okna lub źródła światła</li>
                <li>Upewnij się, że w kadrze widać całą postać</li>
                <li>Załóż ubranie przylegające do ciała</li>
                <li>Wybierz miejsce z równym, łagodnym światłem.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => showView('C')}
              className="w-full min-h-[48px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center mb-2"
            >
              Spróbuj ponownie z innym zdjęciem
            </button>
            <button
              type="button"
              onClick={() => showView('B')}
              className="w-full min-h-[48px] bg-white border border-[#D5CCC0] hover:bg-[#FAF7F2] text-[#242220] font-semibold text-sm rounded-xl transition-all flex items-center justify-center"
            >
              Zobacz pełną instrukcję zdjęcia
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* Stan błędu: Chwilowa niedostępność usługi                 */}
        {/* ========================================================= */}
        {currentView === 'G2' && (
          <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 text-center shadow-xs">
            <div
              className="w-13 h-13 rounded-full bg-[#FDF2F4] text-[#9E1C38] border border-[#F3CAD2] flex items-center justify-center text-xl mx-auto mb-3.5"
              aria-hidden="true"
            >
              🔌
            </div>
            <h2 className="text-[17px] font-bold text-[#242220] tracking-tight">
              Chwilowa niedostępność usługi analizy
            </h2>
            <p className="text-[#6B645C] text-[13px] mt-1.5">
              Nie udało się teraz dokończyć analizy. Możesz spróbować ponownie.
            </p>

            <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 text-left my-4">
              <h5 className="text-[12px] font-bold text-[#242220] mb-1.5">Co możesz teraz zrobić:</h5>
              <ul className="text-[11.5px] text-[#6B645C] space-y-1 pl-4 list-disc">
                <li>Spróbuj ponownie za chwilę.</li>
                <li>Sprawdź stabilność swojego połączenia internetowego</li>
                <li>W razie powtórzenia błędu odśwież stronę aplikacji</li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isAnalysisLoading || isSigningIn}
              onClick={handleStartAnalysis}
              className="w-full min-h-[48px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center mb-2 disabled:opacity-60"
            >
              {isAnalysisLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 motion-reduce:animate-none" size={18} aria-hidden="true" focusable="false" />
                  Próba połączenia...
                </>
              ) : (
                'Ponów próbę analizy'
              )}
            </button>
            <button
              type="button"
              onClick={resetStudio}
              className="w-full min-h-[48px] bg-white border border-[#D5CCC0] hover:bg-[#FAF7F2] text-[#242220] font-semibold text-sm rounded-xl transition-all flex items-center justify-center"
            >
              Wróć do ekranu startowego
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* Stan pusty: Brak dopasowanych propozycji                  */}
        {/* ========================================================= */}
        {currentView === 'G3' && (
          <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 text-center shadow-xs">
            <div
              className="w-13 h-13 rounded-full bg-[#FEF7EE] text-[#92540D] border border-[#F7DDBE] flex items-center justify-center text-xl mx-auto mb-3.5"
              aria-hidden="true"
            >
              👗
            </div>
            <h2 className="text-[17px] font-bold text-[#242220] tracking-tight">
              Nie znaleźliśmy teraz pasujących propozycji
            </h2>
            <p className="text-[#6B645C] text-[13px] mt-1.5">
              Rekomendacje fasonów są gotowe, ale nie znaleźliśmy teraz odpowiadających im produktów.
            </p>

            <div className="bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl p-3 text-left my-4">
              <h5 className="text-[12px] font-bold text-[#242220] mb-1.5">Zalecane kroki:</h5>
              <ul className="text-[11.5px] text-[#6B645C] space-y-1 pl-4 list-disc">
                <li>Możesz przejrzeć rekomendacje krojów i poszukać podobnych ubrań w dowolnym sklepie</li>
                <li>Wróć do podsumowania sylwetki, aby zapoznać się ze wskazówkami stylistki</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => showView('E')}
              className="w-full min-h-[48px] bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center mb-2"
            >
              Wróć do rekomendacji krojów
            </button>
            <button
              type="button"
              onClick={resetStudio}
              className="w-full min-h-[48px] bg-white border border-[#D5CCC0] hover:bg-[#FAF7F2] text-[#242220] font-semibold text-sm rounded-xl transition-all flex items-center justify-center"
            >
              Rozpocznij od nowa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
