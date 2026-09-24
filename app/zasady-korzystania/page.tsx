import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Zasady Korzystania — Stylistka 2026',
  description: 'Zasady i warunki korzystania z wersji beta aplikacji Stylistka 2026.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-10 sm:py-16 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto break-words">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium mb-8 transition-colors min-h-[44px]"
        >
          <ArrowLeft size={16} /> Powrót do strony głównej
        </Link>

        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-4">
            <BookOpen size={12} /> Warunki usługi
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Zasady Korzystania (Wersja Beta)
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Podstawowe warunki uczestnictwa w testach aplikacji Stylistka 2026.
          </p>
        </header>

        <div className="space-y-8 text-slate-300 text-sm sm:text-base leading-relaxed">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" /> 1. Dostęp do wersji beta
            </h2>
            <p>
              Stylistka 2026 jest udostępniana w fazie testów rozwojowych. Dostęp do części funkcji (w tym
              zaawansowanej analizy sylwetki i wirtualnej przymierzalni) wymaga logowania za pomocą konta Google.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" /> 2. Ograniczenia i odpowiedzialność
            </h2>
            <p className="mb-3">
              Rekomendacje generowane przez modele sztucznej inteligencji mają charakter inspiracyjny i doradczy:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 text-sm">
              <li>Użytkownik samodzielnie podejmuje decyzje o ewentualnym zakupie produktów na zewnętrznych stronach sklepów.</li>
              <li>Serwis nie ponosi odpowiedzialności za dostępność towarów, zmiany cen ani realizację zamówień przez sklepy zewnętrzne.</li>
              <li>Wersja beta może podlegać okresowym przerwom technicznym, aktualizacjom i modyfikacjom funkcjonalnym.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3">3. Pula prób wirtualnej przymierzalni</h2>
            <p>
              W ramach ochrony zasobów obliczeniowych każdy użytkownik otrzymuje limit 3 bezpłatnych wygenerowań
              przymiarki VTON. Po wyczerpaniu limitu funkcja zostaje zablokowana do czasu udostępnienia kolejnych
              pakietów w przyszłych wersjach.
            </p>
          </section>

          <p className="text-xs text-slate-500 pt-4 border-t border-white/10">
            Zasady te mają zastosowanie w fazie rozwojowej produktu. Wersja komercyjna otrzyma formalny regulamin świadczenia usług drogą elektroniczną.
          </p>
        </div>
      </div>
    </main>
  );
}
