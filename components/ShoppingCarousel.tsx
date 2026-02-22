'use client';

import { ShoppingBag, Tag, ExternalLink, Shirt, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  price: string;
  store: string;
  imageUrl: string;
  link: string;
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
          setProducts(filtered);
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
      <div className="w-full mt-8 flex justify-center py-12">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
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
              className="flex-none w-64 snap-center bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group/card hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Zdjęcie Produktu */}
              <div className="relative h-48 w-full overflow-hidden">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  onError={() => handleImageError(product.id)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                  <Tag size={12} className="text-indigo-400" /> {product.price}
                </div>
              </div>

              {/* Detale Produktu */}
              <div className="p-4">
                <p className="text-xs text-indigo-300 font-semibold mb-1 uppercase tracking-wide truncate">
                  {product.store}
                </p>
                <h4 className="text-slate-100 font-bold text-sm mb-3 line-clamp-2" title={product.name}>
                  {product.name}
                </h4>

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
