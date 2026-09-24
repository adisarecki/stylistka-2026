import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Tag, Info, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Informacja o Afiliacji — Stylistka 2026',
  description: 'Zasady współpracy afiliacyjnej i oznaczania linków w aplikacji Stylistka 2026.',
};

export default function AffiliatePage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <Tag size={12} /> Transparentność handlowa
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Informacja o Afiliacji i Współpracy
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Zasady oznaczania odnośników do sklepów internetowych oraz przyszłych programów partnerskich.
          </p>
        </header>

        <div className="space-y-8 text-slate-300 text-sm sm:text-base leading-relaxed">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Info size={18} className="text-indigo-400" /> 1. Charakter odnośników
            </h2>
            <p>
              Stylistka 2026 pomaga użytkownikom odkrywać ubrania i dodatki pasujące do ich typu sylwetki
              oraz okazji. Niektóre z prezentowanych linków prowadzących do sklepów internetowych mogą
              w przyszłości mieć charakter afiliacyjny (reklamowy).
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <ExternalLink size={18} className="text-emerald-400" /> 2. Brak dodatkowych kosztów dla użytkownika
            </h2>
            <p>
              Jeżeli użytkownik przejdzie do sklepu partnerskiego za pośrednictwem takiego odnośnika i dokona
              zakupu, aplikacja może otrzymać niewielką prowizję partnerską. Cena dla użytkownika nie wzrasta z tego powodu.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3">3. Niezależność rekomendacji</h2>
            <p>
              Priorytetem algorytmów rekomendacji stylistycznych jest fason, geometria sylwetki oraz wygoda
              użytkownika. Linki handlowe i inspiracyjne są wyraźnie rozróżniane w interfejsie.
            </p>
          </section>

          <p className="text-xs text-slate-500 pt-4 border-t border-white/10">
            Platforma rozwija model współpracy z sieciami afiliacyjnymi z zachowaniem pełnej przejrzystości wobec konsumenta.
          </p>
        </div>
      </div>
    </main>
  );
}
