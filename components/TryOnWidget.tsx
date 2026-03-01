'use client';

import { useState } from 'react';
import { Sparkles, Wand2, Loader2, ShieldCheck, Lightbulb, AlertTriangle, ScanLine, Crown, OctagonX, Star, ChevronDown } from 'lucide-react';
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

export default function TryOnWidget() {
  const [personBase64, setPersonBase64] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    benefit: string;
    tip: string;
    avoid: string;
    uiTitle?: string;
    apiQuery?: string;
    stylistComment?: string;
  } | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);

  const [itemQuery, setItemQuery] = useState<string>('');
  const [occasionQuery, setOccasionQuery] = useState<string>('');
  const [sizeQuery, setSizeQuery] = useState<string>('');
  const [genderQuery, setGenderQuery] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        stylistComment: data.stylistComment
      });
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setAnalysisResult(null);
      setError(err.message || "Nie udało się przeanalizować sylwetki. Spróbuj ponownie.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTryOn = async (clothingImageUrl?: string) => {
    if (!personBase64) return;
    setIsTryOnLoading(true);
    setTryOnResult(null);

    // Użyj przekazanego URL lub domyślnego
    const selectedClothing = clothingImageUrl || "https://raw.githubusercontent.com/yisol/IDM-VTON/main/asserts/examples/garments/00055_00.jpg";

    // Dynamiczna decyzja o kategorii dla Replicate
    let replicateCategory = 'upper_body';
    const qForCategory = (analysisResult?.apiQuery || itemQuery).toLowerCase();
    if (qForCategory.includes('sukienk') || qForCategory.includes('dress')) {
      replicateCategory = 'dresses';
    } else if (qForCategory.includes('spodni') || qForCategory.includes('spódnic') || qForCategory.includes('szort') || qForCategory.includes('jeans')) {
      replicateCategory = 'lower_body';
    }

    try {
      const response = await fetch('/api/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personImage: personBase64,
          clothingImage: selectedClothing,
          category: replicateCategory
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Błąd generowania przymiarki");

      // Wsparcie dla zsanicjonowanego stringa z API
      let imageUrl = data.result;
      if (typeof imageUrl === 'object' && imageUrl !== null) {
        imageUrl = Object.values(imageUrl)[0] || String(imageUrl);
      }
      setTryOnResult(typeof imageUrl === 'string' ? imageUrl : String(imageUrl));
    } catch (err: any) {
      console.error("Try-On Error:", err);
      setError("Nie udało się wygenerować przymiarki: " + err.message);
    } finally {
      setIsTryOnLoading(false);
    }
  };

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

              <ImageUploader
                label="Wgraj zdjęcie sylwetki"
                image={personBase64}
                onUpload={handleUserUpload}
              />
            </div>

            {/* Nowy układ VTON - Wynik pod skanerem */}
            {(isTryOnLoading || tryOnResult) && (
              <div className="mt-8 animate-fade-in-up">
                {isTryOnLoading ? (
                  <div className="mb-6 p-6 bg-slate-900/50 rounded-3xl border border-indigo-500/30 flex flex-col items-center justify-center">
                    <div className="h-2 w-full max-w-xs bg-slate-800 rounded-full overflow-hidden relative mb-4">
                      <div className="absolute inset-0 bg-violet-500/20 animate-pulse"></div>
                      <div className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 animate-shimmer w-[200%] shadow-[0_0_15px_rgba(139,92,246,0.6)]"></div>
                    </div>
                    <p className="text-center text-violet-300 text-sm animate-pulse font-medium flex items-center justify-center gap-2">
                      <Sparkles size={14} className="text-fuchsia-400" /> Twoja stylizacja jest generowana...
                    </p>
                  </div>
                ) : (
                  tryOnResult && (
                    <div className="group">
                      <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                        <Wand2 className="text-pink-400" /> Prawdopodobny wygląd:
                      </h3>
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 group-hover:border-pink-500/50 transition-colors duration-500">
                        <img
                          src={tryOnResult}
                          alt="Wirtualna przymiarka (VTON)"
                          className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                          <span className="text-white text-xs font-medium tracking-wide">Wygenerowano przez AI (IDM-VTON)</span>
                        </div>
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

              {/* Select: Rozmiar */}
              {currentCategory !== 'ACCESSORIES' ? (
                <div className="relative group">
                  <select
                    id="sizeQuery"
                    className="peer w-full bg-slate-900/50 text-slate-100 border-b-2 border-slate-700 py-3 px-1 focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                    value={sizeQuery}
                    onChange={(e) => setSizeQuery(e.target.value)}
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-500">Wybierz rozmiar</option>
                    {currentCategory === 'SHOES' ? (
                      <>
                        <option value="36" className="bg-slate-900">36</option>
                        <option value="37" className="bg-slate-900">37</option>
                        <option value="38" className="bg-slate-900">38</option>
                        <option value="39" className="bg-slate-900">39</option>
                        <option value="40" className="bg-slate-900">40</option>
                        <option value="41" className="bg-slate-900">41</option>
                        <option value="42" className="bg-slate-900">42</option>
                        <option value="43" className="bg-slate-900">43</option>
                        <option value="44" className="bg-slate-900">44</option>
                        <option value="45" className="bg-slate-900">45</option>
                      </>
                    ) : (
                      <>
                        <option value="34" className="bg-slate-900">XS (34)</option>
                        <option value="36" className="bg-slate-900">S (36)</option>
                        <option value="38" className="bg-slate-900">M (38)</option>
                        <option value="40" className="bg-slate-900">L (40)</option>
                        <option value="42" className="bg-slate-900">XL (42)</option>
                      </>
                    )}
                  </select>
                  <label
                    htmlFor="sizeQuery"
                    className="absolute left-1 -top-3.5 text-emerald-400 text-sm transition-all"
                  >
                    Rozmiar (EU)
                  </label>
                  <div className="absolute right-2 top-4 pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors font-bold">
                    <ChevronDown size={14} />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl flex items-center gap-3 text-slate-300">
                  <span className="text-sm">Akcesoria / Dodatki (Rozmiar Uniwersalny)</span>
                </div>
              )}

              {/* Przycisk Mocy */}
              <button
                onClick={handleAnalyzeSilhouette}
                disabled={!personBase64 || isAnalyzing || (isSizeRequired && !sizeQuery.trim())}
                className={`w-full relative group overflow-hidden rounded-xl py-4 font-bold text-lg text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/25 active:scale-95
                  ${(!personBase64 || isAnalyzing || (isSizeRequired && !sizeQuery.trim()))
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
                    <button
                      onClick={() => handleTryOn()}
                      disabled={isTryOnLoading}
                      className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-pink-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
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
                    <p className="text-xs text-slate-400 mt-2 text-center opacity-70">
                      *Generuje podgląd na przykładowej sukience AI
                    </p>
                  </div>

                  {/* Shopping Carousel - Tylko gdy mamy analizę */}
                  <ShoppingCarousel
                    searchQuery={analysisResult?.apiQuery || itemQuery || "Elegancka odzież"}
                    uiTitle={analysisResult?.uiTitle}
                    stylistComment={analysisResult?.stylistComment}
                    onSelectProduct={(url) => handleTryOn(url)}
                    forbiddenKeywords={currentCategory === 'SHOES' ? [] : currentCategory === 'ACCESSORIES' ? [] : ['torebka', 'kolczyki', 'szpilki', 'buty']}
                    size={isSizeRequired ? sizeQuery : undefined}
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
              {tryOnResult && (
                <div className="flex flex-col gap-4">
                  <h4 className="text-xl font-bold text-slate-100 mb-2 flex items-center gap-3">
                    <span className="text-amber-400">Przymiarka</span>
                  </h4>
                  <img
                    src={tryOnResult}
                    alt="Przymiarka"
                    className="rounded-2xl shadow-lg max-w-full h-auto"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

