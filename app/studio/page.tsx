'use client';

import TryOnWidget from "@/components/TryOnWidget";
import MarketHeader from "@/components/MarketHeader";
import AuthGatekeeper from "@/components/AuthGatekeeper";
import AuthHeader from "@/components/AuthHeader";

export default function StudioPage() {
  return (
    <AuthGatekeeper>
      {/* Wszystko poniżej jest NIEDOSTĘPNE do momentu zalogowania */}
      <main className="min-h-screen bg-slate-950">
        <AuthHeader />
        <MarketHeader />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <TryOnWidget />
        </div>
      </main>
    </AuthGatekeeper>
  );
}
