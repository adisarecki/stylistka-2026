'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Wand2, Loader2, ShieldCheck, Lightbulb, AlertTriangle, ScanLine, Crown, OctagonX, Star, ChevronDown, LogIn } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import ImageUploader from './ImageUploader';
import ShoppingCarousel from './ShoppingCarousel';

// Helper: Optymalizacja obrazu do formatu produkcyjnego
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
          reject(new Error("Nie udało się uzyskać kontekstu Canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Eksport do JPG z kompresją 0.8 dla balansu jakość/rozmiar
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error("Błąd ładowania obrazu"));
    };
    reader.onerror = () => reject(new Error("Błąd odczytu pliku"));
  });
};

// ZADANIE 4 (MODUŁ 4): Typy i sylwetki (do Promptowania z Gemini AI)
type BodyShape = 'JABŁKO' | 'GRUSZKA' | 'KLEPSYDRA' | 'KOLUMNA' | 'ROŻEK' | 'NIEZNANA';

export default function TryOnWidget() {
  const [personBase64, setPersonBase64] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    benefit: string;
    tip: string;
    avoid: string;
    uiTitle?: string;
    apiQuery?: string;
    stylistComment?: string;
    bodyShape?: BodyShape;
    garmentDetails?: {
      color?: string;
      garmentType?: string;
      cut?: string;
      occasion?: string;
    };
  } | null>(null);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);

  const [itemQuery, setItemQuery] = useState<string>('');
  const [occasionQuery, setOccasionQuery] = useState<string>('');
  // ZADANIE 1: Obwód klatki piersiowej zamiast wyboru statycznego rozmiaru (EU)
  const [chestCircumference, setChestCircumference] = useState<string>('');
  const [genderQuery, setGenderQuery] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ZADANIE 3: Global Mutex
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);
  const [isAppProcessing, setIsAppProcessing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ZADANIE 4 (MODUŁ 1): System prawdziwej autoryzacji Google Auth (Firebase)
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    // Nasłuchiwanie stanu logowania
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Auth OOPS:", err);
      setError("Nie udało się zalogować. Spróbuj ponownie.");
    }
  };

  // Dynamiczna detekcja kategorii
  const detectCategory = (query: string) => {
    const q = query.toLowerCase();
    if (q.includes('buty') || q.includes('obuw') || q.includes('sneaker') || q.includes('trampki') || q.includes('szpilki') || q.includes('kozaki') || q.includes('sandały') || q.includes('botki') || q.includes('mokasyny')) return 'SHOES';
    if (q.includes('okulary') || q.includes('torebk') || q.includes('czapk') || q.includes('szalik') || q.includes('pasek') || q.includes('biżuteria') || q.includes('naszyjnik') || q.includes('kolczyk') || q.includes('kapelusz') || q.includes('krawat') || q.includes('zegarek')) return 'ACCESSORIES';
    return 'CLOTHES';
  };

  const currentCategory = detectCategory(itemQuery);
  const isSizeRequired = currentCategory !== 'ACCESSORIES';

  const handleUserUpload = async (file: File | null) => {
    if (file) {
      try {
        const optimized = await processImage(file);
        setPersonBase64(optimized);
      } catch (err) {
        console.error("User Image Process Error:", err);
        setError("Nie udało się przetworzyć zdjęcia sylwetki.");
      }
    } else {
      setPersonBase64(null);
    }
  };

  const handleAnalyzeSilhouette = async () => {
    if (!personBase64) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: personBase64,
          query: itemQuery,
          occasion: occasionQuery,
          gender: genderQuery
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Analiza nie powiodła się');

      // Bezpośrednie przypisanie pól z JSON (z fallbackami UI)
      setAnalysisResult({
        benefit: data.strength || "Twoja sylwetka ma potencjał!",
        tip: data.advice || "Eksperymentuj z fasonami.",
        avoid: data.avoid || "Unikaj zaburzeń proporcji.",
        uiTitle: data.uiTitle || "Wybrane dla Ciebie",
        apiQuery: data.apiQuery || itemQuery || "odzież",
        stylistComment: data.stylistComment,
        bodyShape: data.bodyShape || 'NIEZNANA',
        garmentDetails: data.garmentDetails
      });
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setAnalysisResult(null);
      setError(err.message || "Nie udało się przeanalizować sylwetki. Spróbuj ponownie.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTryOn = async (clothingImageUrl?: string, clothingTitle?: string) => {
    // ZADANIE 3: Bezwzględna blokada Global Mutex (isAppProcessing)
    if (!personBase64 || isAppProcessing || isTryOnLoading) return;

    setIsAppProcessing(true); // LOCK START
    setIsTryOnLoading(true);
    setTryOnImage(null);
    setError(null);

    // Użyj przekazanego URL lub domyślnego
    const selectedClothing = clothingImageUrl || "https://raw.githubusercontent.com/yisol/IDM-VTON/main/asserts/examples/garments/00055_00.jpg";
    const title = clothingTitle || analysisResult?.apiQuery || itemQuery || "Elegancka odzież";

    // ZADANIE 4: Moduł 4 (Ulepszone Prompty Sylwetki)
    let bodyModifier = analysisResult?.tip ? ` ${analysisResult.tip}` : "";

    const shape = analysisResult?.bodyShape;
    if (shape === 'JABŁKO') bodyModifier += " +empire +maskująca talia +luźny obrys ciała";
    else if (shape === 'GRUSZKA') bodyModifier += " +rozkloszowana +balans biodra +podkreślona góra z wcięciem";
    else if (shape === 'KLEPSYDRA') bodyModifier += " +dopasowana +podkreśla talię +sylwetka opięta";
    else if (shape === 'KOLUMNA') bodyModifier += " +warstwowa +objętość +struktura geometryczna";
    else if (shape === 'ROŻEK') bodyModifier += " +rozkloszowana dół +uwypukla biodra";

    // Dynamiczna decyzja o kategorii dla Replicate
    let replicateCategory = 'upper_body';
    const qForCategory = (title || analysisResult?.apiQuery || itemQuery).toLowerCase();
    if (qForCategory.includes('sukienk') || qForCategory.includes('dress') || qForCategory.includes('suknia')) {
      replicateCategory = 'dresses';
    } else if (qForCategory.includes('spodni') || qForCategory.includes('spódnic') || qForCategory.includes('szort') || qForCategory.includes('jeans')) {
      replicateCategory = 'lower_body';
    }

    const fetchTryOnWithRetry = async (retries = 5): Promise<any> => {
      try {
        const response = await fetch('/api/try-on', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user?.uid,
            personImage: personBase64,
            clothingImage: selectedClothing,
            category: replicateCategory,
            productTitle: title,
            bodyTypeModifier: bodyModifier
          }),
        });

        const data = await response.json();

        // ZADANIE 2: Smart Retry na Froncie - Maksymalnie 5 prób by zapobiec pętli
        if (response.status === 429 || data.error === "RATE_LIMIT" || response.status === 409) {
          if (retries > 0) {
            console.log(`Limit na serwerze API. Pozostało prób: ${retries - 1}. Czekam 12 sekund...`);
            await new Promise(r => setTimeout(r, 12000));
            return await fetchTryOnWithRetry(retries - 1);
          } else {
            throw new Error("Wirtualna stylistka jest w tej chwili mocno przeciążona przez inne przymiarki. Spróbuj ponownie za kilka minut.");
          }
        }

        if (!response.ok) throw new Error(data.error || "Błąd generowania przymiarki");
        return data;
      } catch (error) {
        throw error;
      }
    };

    try {
      const data = await fetchTryOnWithRetry(5);

      // ZADANIE 2: Wymuszenie stringa przez interpolację
      const cleanStringUrl = `${data.imageUrl}`;
      console.log("Czysty URL do wyrenderowania:", cleanStringUrl);
      setTryOnImage(cleanStringUrl);
    } catch (err: any) {
      console.error("Try-On Error:", err);
      setError(err.message || "Nie udało się wygenerować przymiarki");
    } finally {
      setIsTryOnLoading(false);
      setIsAppProcessing(false); // LOCK END
    }
  };

  // ZADANIE 1: Definicja Skali Zalando
  const ZALANDO_NUMERIC = ["26", "28", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "58", "60", "62", "64"];
  const ZALANDO_ALPHA = ["XXS", "XS", "S", "M", "L", "XL", "XXL (2XL)", "3XL", "4XL", "5XL"];

  // ZADANIE 2 & 3: Size Intelligence (Zalando) + Logika Sąsiadów
  const getMappedSizeAndFallback = (): { sizeEu: string | undefined, sizeAlternative1: string | undefined, sizeAlternative2: string | undefined, fallbackMsg: string | undefined } => {
    if (!chestCircumference || currentCategory === 'ACCESSORIES') return { sizeEu: undefined, sizeAlternative1: undefined, sizeAlternative2: undefined, fallbackMsg: undefined };

    const chestCm = parseInt(chestCircumference, 10);
    if (isNaN(chestCm)) return { sizeEu: undefined, sizeAlternative1: undefined, sizeAlternative2: undefined, fallbackMsg: undefined };

    let predictedSize: string | undefined = undefined;
    let fallbackMsgDraft: string | undefined = undefined;
    let alt1: string | undefined = undefined;
    let alt2: string | undefined = undefined;

    // Damskie (Sukienki / Bluzki - Skala Numeryczna)
    if (genderQuery !== 'mężczyzna' && currentCategory === 'CLOTHES') {
      if (chestCm < 80) predictedSize = "34";
      else if (chestCm >= 80 && chestCm <= 84) predictedSize = "36";
      else if (chestCm >= 85 && chestCm <= 88) predictedSize = "38";
      else if (chestCm >= 89 && chestCm <= 92) predictedSize = "40";
      else if (chestCm >= 93 && chestCm <= 96) predictedSize = "42";
      else if (chestCm >= 97 && chestCm <= 100) predictedSize = "44";
      else if (chestCm > 100 && chestCm <= 106) predictedSize = "46";
      else if (chestCm > 106) predictedSize = "48";

      if (predictedSize) {
        const index = ZALANDO_NUMERIC.indexOf(predictedSize);
        if (index > 0) alt1 = ZALANDO_NUMERIC[index - 1]; // np. 36
        if (index < ZALANDO_NUMERIC.length - 1) alt2 = ZALANDO_NUMERIC[index + 1]; // np. 40
      }
    }
    // Męskie (Góra Portwest - Skala Alfa)
    else if (genderQuery === 'mężczyzna' && currentCategory === 'CLOTHES') {
      if (chestCm < 92) predictedSize = "S";
      else if (chestCm >= 92 && chestCm <= 96) predictedSize = "M";
      else if (chestCm >= 97 && chestCm <= 104) predictedSize = "L";
      else if (chestCm >= 105 && chestCm <= 112) predictedSize = "XL";
      else if (chestCm > 112) predictedSize = "XXL (2XL)";

      if (predictedSize) {
        const index = ZALANDO_ALPHA.indexOf(predictedSize);
        if (index > 0) alt1 = ZALANDO_ALPHA[index - 1];
        if (index < ZALANDO_ALPHA.length - 1) alt2 = ZALANDO_ALPHA[index + 1];
      }
    }

    if (predictedSize && alt1 && alt2) {
      fallbackMsgDraft = `Dopasowaliśmy rozmiar ${predictedSize}. Dostępne również: ${alt1}, ${alt2}`;
    } else if (predictedSize) {
      fallbackMsgDraft = `Dopasowaliśmy rozmiar ${predictedSize}.`;
    }

    return { sizeEu: predictedSize, sizeAlternative1: alt1, sizeAlternative2: alt2, fallbackMsg: fallbackMsgDraft };
  };

  const { sizeEu: mappedSize, sizeAlternative1: sizeAlt1, sizeAlternative2: sizeAlt2, fallbackMsg: mappedFallback } = getMappedSizeAndFallback();

  // FIX: Fetch musi być uwięziony w Hooku, żeby zapobiec nieskończonej pętli zjawiska Side-Effect podczas Renderu React!
  useEffect(() => {
    if (mappedSize && user?.uid && !isAnalyzing) {
      const parsedChestCm = parseInt(chestCircumference, 10);
      fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, zalandoSize: mappedSize, chestCm: isNaN(parsedChestCm) ? null : parsedChestCm })
      }).catch(() => { });
    }
  }, [mappedSize, user?.uid, isAnalyzing, chestCircumference]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
        <p className="text-slate-400 font-medium tracking-wide">Inicjalizacja bezpiecznego wariantu VTON...</p>
      </div>
    );
  }

  // Pełnoekranowa blokada została usunięta by użytkownik widział aplikację bez logowania
  // Logowanie znajduje się teraz w lewym panelu skanera (Tarcza Prywatności) i blokuje klawisze przymiarki

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* Lewy Kontener: Skaner Sylwetki */}
        <div className="relative group overflow-hidden rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl transition-all duration-500 hover:border-indigo-500/30">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-violet-500/10 opacity-50 pointer-events-none" />

          <div className="relative p-6 z-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-3">
              <ScanLine className="text-indigo-400 animate-pulse" /> Skaner Sylwetki AI
            </h2>

            <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-700/50 hover:border-indigo-500/50 transition-colors bg-slate-900/50 min-h-[400px] flex items-center justify-center">
              {/* Animacja skanowania */}
              {isAnalyzing && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  <div className="w-full h-1 bg-indigo-500 shadow-[0_0_15px_2px_rgba(99,102,241,0.8)] animate-scan" />
                </div>
              )}

              {/* Pasek profilu po zalogowaniu */}
              {user && (
                <div className="absolute top-4 right-4 z-30 bg-black/40 backdrop-blur border border-white/10 px-4 py-2 rounded-full flex items-center gap-3 shadow-xl">
                  <img src={user.photoURL || ''} alt="User" className="w-6 h-6 rounded-full border border-indigo-500/30" />
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[100px]">{user.displayName}</span>
                  <button onClick={() => signOut(auth)} className="ml-2 text-rose-400 hover:text-rose-300 text-xs font-bold uppercase tracking-wider transition-colors">Wyloguj</button>
                </div>
              )}

              {user ? (
                <ImageUploader
                  label="Wgraj zdjęcie sylwetki"
                  image={personBase64}
                  onUpload={handleUserUpload}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in-up">
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                    <ShieldCheck size={40} className="text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Prywatność przede wszystkim</h3>
                  <p className="text-slate-400 max-w-sm mb-8 text-sm leading-relaxed">
                    Aby zadbać o Twoje bezpieczeństwo, autoryzuj sesję. Twoje zdjęcia "w majtkach" trafią do zaszyfrowanej chmury, a po przymiarce ulegną auto-destrukcji.
                  </p>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={isAuthLoading}
                    className="bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 px-8 rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl"
                  >
                    {isAuthLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                    Zaloguj z Google
                  </button>
                </div>
              )}
            </div>

            {/* Nowy układ VTON - Wynik pod skanerem */}
            {(isTryOnLoading || tryOnImage) && (
              <div className="mt-8 animate-fade-in-up">
                {isTryOnLoading ? (
                  <div className="mb-6 p-6 bg-slate-900/50 rounded-3xl border border-indigo-500/30 flex flex-col items-center justify-center">
                    <div className="h-2 w-full max-w-xs bg-slate-800 rounded-full overflow-hidden relative mb-4">
                      <div className="absolute inset-0 bg-violet-500/20 animate-pulse"></div>
                      <div className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 animate-shimmer w-[200%] shadow-[0_0_15px_rgba(139,92,246,0.6)]"></div>
                    </div>
                    <p className="text-center text-violet-300 text-sm animate-pulse font-medium flex items-center justify-center gap-2">
                      <Sparkles size={14} className="text-fuchsia-400" /> Stylizuję Twój look... To zaawansowany proces AI (zajmie ok. 15 sekund).
                    </p>
                  </div>
                ) : (
                  tryOnImage && (
                    <div className="group">
                      {typeof tryOnImage === 'string' && tryOnImage.startsWith('http') && (
                        <div className="mt-6 flex flex-col items-center">
                          <h3 className="text-lg font-bold text-white mb-2">Prawdopodobny wygląd:</h3>
                          <img src={tryOnImage} alt="Przymiarka VTON" className="w-full h-auto rounded-lg shadow-xl" />
                        </div>
                      )}

                      <div className="relative mt-2">
                        {!(typeof tryOnImage === 'string' && tryOnImage.startsWith('http')) && (
                          <div className="w-full h-64 bg-slate-900 flex items-center justify-center text-red-400 text-sm p-4 text-center rounded-2xl">
                            Wystąpił błąd ładowania obrazu z Replicate. Odśwież i spróbuj ponownie.<br />
                            <span className="text-xs opacity-50 mt-2">{String(tryOnImage)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Prawy Kontener: Centrum Dowodzenia */}
        <div className="flex flex-col gap-6">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            {/* Dekoracyjne Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />

            <h2 className="text-2xl font-bold text-slate-100 mb-8 flex items-center gap-3 relative z-10">
              <Wand2 className="text-violet-400" /> Parametry Stylizacji
            </h2>

            <div className="space-y-8 relative z-10">
              {/* Input: Czego szukasz? */}
              <div className="relative group">
                <input
                  type="text"
                  id="itemQuery"
                  className="peer w-full bg-slate-900/50 text-slate-100 border-b-2 border-slate-700 py-3 px-1 focus:outline-none focus:border-indigo-500 transition-colors placeholder-transparent"
                  placeholder="Czego szukasz?"
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                />
                <label
                  htmlFor="itemQuery"
                  className="absolute left-1 -top-3.5 text-slate-400 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-3 peer-focus:-top-3.5 peer-focus:text-indigo-400 peer-focus:text-sm"
                >
                  Czego szukasz? (np. sukienka na wesele)
                </label>
              </div>

              {/* Input: Okazja */}
              <div className="relative group">
                <input
                  type="text"
                  id="occasionQuery"
                  className="peer w-full bg-slate-900/50 text-slate-100 border-b-2 border-slate-700 py-3 px-1 focus:outline-none focus:border-violet-500 transition-colors placeholder-transparent"
                  placeholder="Okazja"
                  value={occasionQuery}
                  onChange={(e) => setOccasionQuery(e.target.value)}
                />
                <label
                  htmlFor="occasionQuery"
                  className="absolute left-1 -top-3.5 text-slate-400 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-3 peer-focus:-top-3.5 peer-focus:text-violet-400 peer-focus:text-sm"
                >
                  Okazja (np. gala wieczorowa)
                </label>
              </div>

              {/* Sekcja Zaawansowana (Opcjonalnie) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-2 font-medium transition-colors"
                >
                  ⚙️ {showAdvanced ? 'Ukryj zaawansowane' : 'Opcje zaawansowane (np. wymuś płeć/krój)'}
                </button>

                {showAdvanced && (
                  <div className="mt-4 animate-fade-in-up">
                    <div className="relative group">
                      <select
                        id="genderQuery"
                        className="peer w-full bg-slate-900/50 text-slate-100 border-b-2 border-slate-700 py-3 px-1 focus:outline-none focus:border-pink-500 transition-colors appearance-none cursor-pointer"
                        value={genderQuery}
                        onChange={(e) => setGenderQuery(e.target.value)}
                      >
                        <option value="" className="bg-slate-900 text-slate-500">Auto (AI dopasuje do zdjęcia)</option>
                        <option value="kobieta" className="bg-slate-900">Kobieta</option>
                        <option value="mężczyzna" className="bg-slate-900">Mężczyzna</option>
                        <option value="inne" className="bg-slate-900">Inne / Uniseks</option>
                      </select>
                      <label
                        htmlFor="genderQuery"
                        className="absolute left-1 -top-3.5 text-pink-400 text-sm transition-all"
                      >
                        Wymuś Płeć / Krój
                      </label>
                      <div className="absolute right-2 top-4 pointer-events-none text-slate-500 group-focus-within:text-pink-400 transition-colors font-bold">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input: Rozmiar -> Obwód klatki (Size Intelligence Horeca) */}
              {currentCategory !== 'ACCESSORIES' ? (
                <div className="relative group">
                  <input
                    type="number"
                    id="chestCircumference"
                    className="peer w-full bg-slate-900/50 text-slate-100 border-b-2 border-slate-700 py-3 px-1 focus:outline-none focus:border-emerald-500 transition-colors placeholder-transparent"
                    placeholder="Obwód klatki piersiowej (cm)"
                    value={chestCircumference}
                    onChange={(e) => setChestCircumference(e.target.value)}
                  />
                  <label
                    htmlFor="chestCircumference"
                    className="absolute left-1 -top-3.5 text-emerald-400 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-3 peer-focus:-top-3.5 peer-focus:text-emerald-400 peer-focus:text-sm"
                  >
                    Obwód klatki piersiowej (cm)
                  </label>
                </div>
              ) : (
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl flex items-center gap-3 text-slate-300">
                  <span className="text-sm">Akcesoria / Dodatki (Rozmiar Uniwersalny)</span>
                </div>
              )}

              {/* Przycisk Mocy */}
              <button
                onClick={handleAnalyzeSilhouette}
                disabled={!personBase64 || !user || isAnalyzing || isAppProcessing || (isSizeRequired && !chestCircumference.trim())}
                className={`w-full relative group overflow-hidden rounded-xl py-4 font-bold text-lg text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/25 active:scale-95
                  ${(!personBase64 || !user || isAnalyzing || isAppProcessing || (isSizeRequired && !chestCircumference.trim()))
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed grayscale'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-glow'}`}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin" /> Analizowanie...
                    </>
                  ) : (
                    <>
                      <Sparkles className="group-hover:rotate-12 transition-transform" /> Uruchom Stylistkę AI
                    </>
                  )}
                </span>
                {/* Poświata przycisku */}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-200 animate-fade-in-up">
                  <AlertTriangle className="shrink-0 text-red-400" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sekcja Wyników */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl min-h-[300px] relative">
            <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <Lightbulb className="text-amber-400" /> Werdykt Stylistki
            </h3>

            <div className="space-y-4">
              {!isAnalyzing && !error && analysisResult ? (
                <div className="flex flex-col gap-4">
                  {/* Karta: Atut */}
                  <div className="group bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl transition-all duration-300 hover:bg-white/15 hover:scale-[1.01] animate-fade-in-up [animation-delay:100ms]">
                    <h4 className="text-indigo-400 font-bold text-lg mb-2 flex items-center gap-2">
                      <Star className="text-yellow-400 fill-yellow-400 animate-pulse" size={20} /> Twój Atut
                    </h4>
                    <p className="text-slate-100 leading-relaxed font-medium">{analysisResult.benefit}</p>
                  </div>

                  {/* Karta: Złota Porada */}
                  <div className="group bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl transition-all duration-300 hover:bg-white/15 hover:scale-[1.01] animate-fade-in-up [animation-delay:200ms]">
                    <h4 className="text-amber-400 font-bold text-lg mb-2 flex items-center gap-2">
                      <Crown className="text-amber-500 fill-amber-500/20" size={20} /> Złota Porada
                    </h4>
                    <p className="text-slate-100 leading-relaxed font-medium">{analysisResult.tip}</p>
                  </div>

                  {/* Karta: Unikaj */}
                  <div className="group bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl transition-all duration-300 hover:bg-white/15 hover:scale-[1.01] animate-fade-in-up [animation-delay:300ms]">
                    <h4 className="text-rose-400 font-bold text-lg mb-2 flex items-center gap-2">
                      <OctagonX className="text-rose-500" size={20} /> Unikaj
                    </h4>
                    <p className="text-slate-100 leading-relaxed font-medium">{analysisResult.avoid}</p>
                  </div>

                  {/* Sekcja Wirtualnej Przymiarki - HIBERNACJA (FAZA 2) WYBUDZONA */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    {!user ? (
                      <button
                        onClick={handleGoogleLogin}
                        className="w-full font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95"
                      >
                        <LogIn size={20} className="text-indigo-400 group-hover:-translate-x-1" />
                        Zaloguj się, by korzystać z AI
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTryOn()}
                        disabled={isAppProcessing || !personBase64}
                        className={`w-full font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group
                            ${(isAppProcessing || !personBase64)
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed grayscale shadow-none'
                            : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:shadow-pink-500/25 hover:scale-[1.02] active:scale-95'}`}
                      >
                        {isTryOnLoading ? (
                          <>
                            <Loader2 className="animate-spin" /> Generowanie przymiarki...
                          </>
                        ) : (
                          <>
                            <Wand2 className="text-pink-200 group-hover:rotate-12 transition-transform" /> Zobacz wirtualną przymiarkę
                          </>
                        )}
                      </button>
                    )}
                    <p className="text-xs text-slate-400 mt-2 text-center opacity-70">
                      *Generuje podgląd na przykładowej sukience AI
                    </p>
                  </div>

                  {/* Shopping Carousel - Tylko gdy mamy analizę */}
                  <ShoppingCarousel
                    searchQuery={analysisResult?.apiQuery || itemQuery || "Elegancka odzież"}
                    uiTitle={analysisResult?.uiTitle}
                    stylistComment={analysisResult?.stylistComment}
                    garmentDetails={analysisResult?.garmentDetails}
                    onSelectProduct={(url, title) => handleTryOn(url, title)}
                    forbiddenKeywords={currentCategory === 'SHOES' ? [] : currentCategory === 'ACCESSORIES' ? [] : ['torebka', 'kolczyki', 'szpilki', 'buty']}
                    size={isSizeRequired ? mappedSize : undefined}
                    sizeAlternative1={isSizeRequired ? sizeAlt1 : undefined}
                    sizeAlternative2={isSizeRequired ? sizeAlt2 : undefined}
                    isTryOnLoading={isAppProcessing} // ZADANIE 1: Zabezpieczenie przed auto-fire w muteksie
                    sizeIntelligentFallback={mappedFallback}
                    isLoggedIn={!!user}
                    onLoginRequest={handleGoogleLogin}
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic mt-12">
                  <Wand2 size={48} className="opacity-20 mb-4" />
                  <p>Wyniki analizy pojawią się tutaj...</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              {/* Usunięto zduplikowany blok renderowania, wszystko odbywa się powyżej z nowym blokiem. */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

