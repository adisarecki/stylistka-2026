'use client';

import { Globe } from 'lucide-react';
import { useMarket } from './MarketContext';

export default function MarketHeader() {
  const { market } = useMarket();

  return (
    <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-50">
      <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-full text-slate-300 text-xs font-medium backdrop-blur-md shadow-sm">
        <Globe size={14} className="text-indigo-400 shrink-0" />
        <span>Dostawa: <strong className="text-slate-100 font-semibold">{market.countryName}</strong> ({market.currency})</span>
      </div>
    </div>
  );
}
