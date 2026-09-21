'use client';

import { ShoppingBag, Tag, ExternalLink, Shirt, Loader2, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authenticatedFetch, AuthenticationRequiredError } from '@/lib/auth-fetch';
import { CanonicalProduct, hasVerifiedTryOnAsset } from '@/types/product';
import { useMarket } from './MarketContext';

export default function ShoppingCarousel({
  searchQuery,
  uiTitle,
  stylistComment,
  garmentDetails,
  onSelectProduct,
  forbiddenKeywords = [],
  size,
  sizeAlternative1,
  sizeAlternative2,
  isTryOnLoading = false,
  sizeIntelligentFallback,
  isLoggedIn = false,
  onLoginRequest
}: {
  searchQuery: string;
  uiTitle?: string;
  stylistComment?: string;
  garmentDetails?: {
    color?: string;
    garmentType?: string;
    cut?: string;
    occasion?: string;
  };
  onSelectProduct: (url: string, title?: string) => void;
  forbiddenKeywords?: string[];
  size?: string;
  sizeAlternative1?: string;
  sizeAlternative2?: string;
  isTryOnLoading?: boolean;
  sizeIntelligentFallback?: string;
  isLoggedIn?: boolean;
  onLoginRequest?: () => void;
}) {
  const { market } = useMarket();
  const [products, setProducts] = useState<CanonicalProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAlternative, setIsAlternative] = useState(false);

  const color = garmentDetails?.color;
  const garmentType = garmentDetails?.garmentType;
  const cut = garmentDetails?.cut;
  const occasion = garmentDetails?.occasion;

  useEffect(() => {
    if (!searchQuery) return;

    const fetchProducts = async () => {
      setLoading(true);
      setIsAlternative(false);
      try {
        let url = `/api/products?q=${encodeURIComponent(searchQuery)}&market=${encodeURIComponent(market.marketCode)}${size ? `&size=${encodeURIComponent(size)}` : ''}`;

        if (color) url += `&color=${encodeURIComponent(color)}`;
        if (garmentType) url += `&type=${encodeURIComponent(garmentType)}`;
        if (cut) url += `&cut=${encodeURIComponent(cut)}`;
        if (occasion) url += `&occasion=${encodeURIComponent(occasion)}`;

        const response = await authenticatedFetch(url);
        if (!response.ok) {
          setProducts([]);
          return;
        }
        const data = await response.json();

        if (data.products && Array.isArray(data.products)) {
          let filtered: CanonicalProduct[] = data.products;

          if (forbiddenKeywords.length > 0) {
            filtered = filtered.filter((p: CanonicalProduct) =>
              !forbiddenKeywords.some(k => p.title.toLowerCase().includes(k.toLowerCase()))
            );
          }

          setProducts(filtered);
          setIsAlternative(!!data.isAlternative);
        } else {
          setProducts([]);
        }
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          setProducts([]);
        } else {
          console.error("Failed to fetch products:", error);
          setProducts([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [
    searchQuery,
    forbiddenKeywords,
    size,
    sizeAlternative1,
    sizeAlternative2,
    color,
    garmentType,
    cut,
    occasion,
    market.marketCode
  ]);

  const handleImageError = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  if (loading) {
    return (
      <div className="w-full mt-8 flex flex-col items-center justify-center py-12 gap-4 animate-pulse">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
        <p className="text-slate-300 font-medium text-sm text-center">
          Wyszukuję pasujące inspiracje modowe...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full mt-8 animate-fade-in-up [animation-delay:400ms]">
      <div className="flex flex-col mb-6 px-2">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
          <ShoppingBag className="text-indigo-400" /> {uiTitle || "Inspiracje dla Ciebie"}
        </h3>
        {stylistComment && (
          <p className="text-slate-400 text-sm mt-1 italic font-medium border-l-2 border-indigo-500/30 pl-3">
            {stylistComment}
          </p>
        )}

        {(isAlternative || sizeIntelligentFallback) && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 animate-fade-in-up">
            <Tag className="text-emerald-400 shrink-0" size={18} />
            <p className="text-emerald-200 text-xs md:text-sm font-medium">
              {sizeIntelligentFallback || "Brak Twojego rozmiaru w głównych propozycjach. Oto wyselekcjonowane alternatywy dla Twojej sylwetki."}
            </p>
          </div>
        )}
      </div>

      <div className="relative group">
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

        <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide px-2">
          {products.map((product) => {
            const canTryOn = hasVerifiedTryOnAsset(product);

            return (
              <div
                key={product.id}
                className="flex-none w-64 snap-center bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 group/card flex flex-col hover:border-indigo-500/30 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Zdjęcie Produktu */}
                <div className="relative h-48 w-full overflow-hidden shrink-0">
                  <img
                    src={product.heroImage.url}
                    alt={product.title}
                    onError={() => handleImageError(product.id)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                  />
                  {/* Etykieta charakteru źródła */}
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-slate-300 text-[10px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg border border-white/10">
                    <Sparkles size={11} className="text-indigo-400" /> Inspiracja z internetu
                  </div>
                </div>

                {/* Detale Produktu */}
                <div className="p-4 flex flex-col flex-grow justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide truncate text-indigo-300">
                        {product.merchant.name}
                      </p>
                    </div>
                    <h4 className="text-slate-100 font-bold text-sm mb-3 line-clamp-2" title={product.title}>
                      {product.title}
                    </h4>
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    <div className="flex gap-2">
                      <a
                        href={product.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center bg-white/10 hover:bg-white/20 text-slate-200 font-medium py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1"
                      >
                        Zobacz źródło <ExternalLink size={12} />
                      </a>

                      {canTryOn && (
                        !isLoggedIn ? (
                          <button
                            onClick={onLoginRequest}
                            className="flex-1 font-medium py-2 rounded-xl transition-all text-[10px] leading-tight flex items-center justify-center gap-1 shadow-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95"
                          >
                            Zaloguj się
                          </button>
                        ) : (
                          <button
                            onClick={() => !isTryOnLoading && onSelectProduct(product.tryOnAsset.image.url, product.title)}
                            disabled={isTryOnLoading}
                            className={`flex-1 font-medium py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1 shadow-lg
                              ${isTryOnLoading
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 active:scale-95'}`}
                          >
                            {isTryOnLoading ? 'Pracuję...' : 'Przymierz'} <Shirt size={12} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {products.length === 0 && (
            <div className="w-full text-center py-8 text-slate-500 italic">
              Nie znaleziono produktów pasujących do &quot;{searchQuery}&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
