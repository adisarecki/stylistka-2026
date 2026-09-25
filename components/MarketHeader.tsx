'use client';

import { Globe } from 'lucide-react';
import { useMarket } from './MarketContext';

export default function MarketHeader() {
  const { market } = useMarket();

  return (
    <div className="flex items-center justify-end max-w-5xl mx-auto px-4 pt-2 pb-0">
      <div className="inline-flex items-center gap-1.5 bg-[#FFFFFF] border border-[#EAE3D9] px-2.5 py-1 rounded-full text-[#6B645C] text-[11px] font-medium shadow-xs">
        <Globe size={12} className="text-[#83223A] shrink-0" />
        <span>Dostawa: <strong className="text-[#242220] font-semibold">{market.countryName}</strong> ({market.currency})</span>
      </div>
    </div>
  );
}
