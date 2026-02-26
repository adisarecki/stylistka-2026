'use client';

import { ShoppingBag, Tag, ExternalLink, Shirt, Loader2, MapPin, Map, Phone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLocation } from './LocationContext';

interface Product {
  id: string;
  name: string;
  price: string;
  store: string;
  imageUrl: string;
  link: string;
  isLocal?: boolean;
  distance?: string;
}

export default function ShoppingCarousel({
  searchQuery,
  uiTitle,
  stylistComment,
  onSelectProduct,
  forbiddenKeywords = [],
  size
}: {
  searchQuery: string,
  uiTitle?: string,
  stylistComment?: string,
  onSelectProduct: (url: string) => void,
  forbiddenKeywords?: string[],
  size?: string
}) {
  const { location } = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAlternative, setIsAlternative] = useState(false);

  useEffect(() => {
    if (!searchQuery) return;

    const fetchProducts = async () => {
      setLoading(true);
      setIsAlternative(false);
      try {
        const url = `/api/products?q=${encodeURIComponent(searchQuery)}${size ? `&size=${encodeURIComponent(size)}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.products) {
          let filtered = data.products;
          // Apply forbidden keywords filter if any
          if (forbiddenKeywords.length > 0) {
            filtered = filtered.filter((p: Product) =>
              !forbiddenKeywords.some(k => p.name.toLowerCase().includes(k.toLowerCase()))
            );
          }

          // Inject Local Partners
          const localPartners: Product[] = [
            {
              id: 'local-1',
              name: 'Jedwabna Sukienka Wieczorowa',
              price: '450 PLN',
              store: 'Butik Lady eM',
              imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80',
              link: 'https://www.facebook.com/profile.php?id=100063628373739', // Przykładowy realny/mockowany link do FB
              isLocal: true,
              distance: '2.5 km',
            },
            {
              id: 'local-2',
              name: 'Elegancka Marynarka Premium',
              price: '399 PLN',
              store: 'Butik Verona',
              imageUrl: 'https://images.unsplash.com/photo-1591369822096-0d4ee16ac0b7?w=800&q=80',
              link: 'https://www.instagram.com/explore/tags/butikverona/', // Przykładowy realny/mockowany link do IG
              isLocal: true,
              distance: '3.1 km',
            }
          ];

          const injectedProducts: Product[] = [];
          let localIndex = 0;
          for (let i = 0; i < filtered.length; i++) {
            injectedProducts.push(filtered[i]);
            // Wstrzykuj partnera lokalnego co trzeci element (czyli po 2 normalnych)
            if ((i + 1) % 2 === 0 && localIndex < localPartners.length) {
              injectedProducts.push(localPartners[localIndex]);
              localIndex++;
            }
          }

          setProducts(injectedProducts);
          setIsAlternative(!!data.isAlternative);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [searchQuery, forbiddenKeywords]);

  const handleImageError = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  if (loading) {
    return (
      <div className="w-full mt-8 flex flex-col items-center justify-center py-12 gap-4 animate-pulse">
        <Loader2 className="animate-spin text-amber-500" size={40} />
        <p className="text-amber-200 font-medium text-sm text-center">Szukam najlepszych okazji w Twojej okolicy<br /><span className="text-indigo-300 text-xs">({location})</span></p>
      </div>
    );
  }

  return (
    <div className="w-full mt-8 animate-fade-in-up [animation-delay:400ms]">
      <div className="flex flex-col mb-6 px-2">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
          <ShoppingBag className="text-indigo-400" /> {uiTitle || "Polecane dla Ciebie"}
        </h3>
        {stylistComment && (
          <p className="text-slate-400 text-sm mt-1 italic font-medium border-l-2 border-indigo-500/30 pl-3">
            {stylistComment}
          </p>
        )}

        {/* Graceful Fallback Message */}
        {isAlternative && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 animate-fade-in-up">
            <Tag className="text-amber-400 shrink-0" size={18} />
            <p className="text-amber-200 text-xs md:text-sm font-medium">
              Brak Twojego rozmiaru w głównych propozycjach. Oto wyselekcjonowane alternatywy dla Twojej sylwetki.
            </p>
          </div>
        )}
      </div>

      <div className="relative group">
        {/* Gradient Fade na krawędziach */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

        {/* Kontener z przewijaniem */}
        <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide px-2">
          {products.map((product) => (
            <div
              key={product.id}
              className={`flex-none w-64 snap-center bg-white/5 border backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 group/card flex flex-col ${product.isLocal
                ? 'border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.15)] hover:shadow-[0_0_25px_rgba(251,191,36,0.3)] hover:-translate-y-1 hover:border-amber-400'
                : 'border-white/10 hover:border-indigo-500/30 hover:-translate-y-1 hover:shadow-xl'
                }`}
            >
              {/* Zdjęcie Produktu */}
              <div className="relative h-48 w-full overflow-hidden shrink-0">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  onError={() => handleImageError(product.id)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                  <Tag size={12} className={product.isLocal ? 'text-amber-400' : 'text-indigo-400'} /> {product.price}
                </div>
                {product.isLocal && (
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider shadow-lg flex items-center gap-1">
                    <MapPin size={10} /> Lokalna Perełka
                  </div>
                )}
              </div>

              {/* Detale Produktu */}
              <div className="p-4 flex flex-col flex-grow justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <p className={`text-xs font-semibold uppercase tracking-wide truncate ${product.isLocal ? 'text-amber-300' : 'text-indigo-300'}`}>
                      {product.store}
                    </p>
                    {product.isLocal && (
                      <span className="text-[10px] text-amber-200/90 font-bold bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                        {product.distance}
                      </span>
                    )}
                  </div>
                  <h4 className="text-slate-100 font-bold text-sm mb-3 line-clamp-2" title={product.name}>
                    {product.name}
                  </h4>
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex gap-2">
                    <a
                      href={product.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center bg-white/10 hover:bg-white/20 text-slate-200 font-medium py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1"
                    >
                      Sprawdź <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={() => onSelectProduct(product.imageUrl)} // Google Image URL for Try-On
                      className="hidden flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1 shadow-lg shadow-indigo-500/20"
                    >
                      Przymierz <Shirt size={12} />
                    </button>
                  </div>

                  {product.isLocal && (
                    <div className="mt-2 pt-3 border-t border-amber-500/20 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[9px] text-amber-200/70 uppercase font-bold tracking-widest whitespace-nowrap rounded-sm">
                        Odbierz / Przymierz Lokalnie
                      </div>
                      <div className="flex gap-2 mt-1">
                        <a
                          href="https://maps.google.com/?q=Butik+Lady+eM"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-amber-500/10 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1 font-medium group-hover/card:bg-amber-500/20"
                        >
                          <Map size={12} /> Trasa
                        </a>
                        <a
                          href="tel:+48123456789"
                          className="flex-1 bg-amber-500/10 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1 font-medium group-hover/card:bg-amber-500/20"
                        >
                          <Phone size={12} /> Zadzwoń
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="w-full text-center py-8 text-slate-500 italic">
              Nie znaleziono produktów pasujących do "{searchQuery}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
