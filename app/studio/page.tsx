'use client';

import TryOnWidget from "@/components/TryOnWidget";
import MarketHeader from "@/components/MarketHeader";
import AuthHeader from "@/components/AuthHeader";

export default function StudioPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#242220] overflow-x-hidden flex flex-col">
      <AuthHeader />
      <MarketHeader />
      <div className="w-full flex-grow flex flex-col items-center">
        <TryOnWidget />
      </div>
    </main>
  );
}
