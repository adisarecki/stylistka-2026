import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Wand2,
  Scan,
  Compass,
  Lock,
  Shirt,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-white overflow-x-hidden">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group min-h-[44px]">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles size={16} />
            </span>
            <span className="font-bold text-lg tracking-tight text-white">
              Stylistka <span className="text-indigo-400">2026</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-300 font-medium">
            <a href="#jak-to-dziala" className="hover:text-white transition-colors">
              Jak to działa
            </a>
            <a href="#korzysci" className="hover:text-white transition-colors">
              Wartość
            </a>
            <a href="#partnerzy" className="hover:text-white transition-colors">
              Dla partnerów
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-semibold min-h-[44px] py-2.5 px-3.5 sm:px-5 rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              Wypróbuj wersję beta
              <ArrowRight size={14} className="hidden sm:inline" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-28 sm:pb-32 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          {/* Subtle Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[550px] h-[350px] bg-gradient-to-tr from-indigo-600/15 via-violet-600/15 to-fuchsia-600/10 blur-[130px] rounded-full pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10">
            {/* Beta Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-8 backdrop-blur-sm shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Wersja beta
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 font-normal">Technologia modowa AI</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.15] break-words text-balance">
              Twój styl. Lepsze dopasowanie.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                Mniej przypadkowych zakupów.
              </span>
            </h1>

            {/* Description */}
            <p className="text-slate-300 text-sm sm:text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto font-normal">
              Stylistka 2026 wykorzystuje AI, aby analizować preferencje, okazję i podane parametry, a następnie
              tworzyć spersonalizowane wskazówki stylizacyjne oraz pomagać odkrywać pasujące produkty dostępne online.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-10 w-full">
              <Link
                href="/studio"
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-base font-semibold py-3.5 px-8 rounded-xl transition-all shadow-xl shadow-indigo-600/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
              >
                Wypróbuj wersję beta
                <ArrowRight size={18} />
              </Link>

              <a
                href="#jak-to-dziala"
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-base font-medium py-3.5 px-6 rounded-xl transition-all backdrop-blur-sm active:scale-95"
              >
                Zobacz, jak to działa
              </a>
            </div>

            {/* Trust disclaimer */}
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Usługa ma charakter doradczo-inspiracyjny. Nie stanowi profesjonalnej diagnozy ani medycznej porady.
            </p>
          </div>
        </section>

        {/* Section: Jak to działa (3 kroki) */}
        <section id="jak-to-dziala" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase mb-2 block">
                Architektura doświadczenia
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Jak działa Stylistka 2026
              </h2>
              <p className="text-slate-400 text-sm sm:text-base mt-3 max-w-xl mx-auto">
                Trzy proste kroki dzielą Cię od obiektywnej analizy proporcji i propozycji stylizacyjnych.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {/* Krok 1 */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm relative group hover:border-indigo-500/30 transition-all flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 font-bold text-lg">
                  1
                </div>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Scan size={18} className="text-indigo-400" /> Dodaj zdjęcie
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mt-1">
                  Użytkownik przesyła zdjęcie sylwetki zgodnie ze wskazówkami w interfejsie. Analiza uwzględnia
                  podstawowe proporcje anatomiczne.
                </p>
              </div>

              {/* Krok 2 */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm relative group hover:border-violet-500/30 transition-all flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-6 font-bold text-lg">
                  2
                </div>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Wand2 size={18} className="text-violet-400" /> Określ, czego szukasz
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mt-1">
                  Wpisz okazję (np. rozmowa rekrutacyjna, wesele, casual) oraz preferowany rodzaj garderoby
                  i opcjonalne wymiary.
                </p>
              </div>

              {/* Krok 3 */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm relative group hover:border-fuchsia-500/30 transition-all flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center mb-6 font-bold text-lg">
                  3
                </div>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Compass size={18} className="text-fuchsia-400" /> Odbierz rekomendacje
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mt-1">
                  Sztuczna inteligencja przygotowuje konkretne wskazówki fasonowe, atuty sylwetki oraz inspiracje
                  produktowe z czytelnym oznaczeniem źródła.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Wartość dla użytkownika */}
        <section id="korzysci" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-slate-900/20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold tracking-widest text-violet-400 uppercase mb-2 block">
                Zalety technologiczne
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Dlaczego Stylistka 2026?
              </h2>
              <p className="text-slate-400 text-sm sm:text-base mt-3 max-w-xl mx-auto">
                Skupiamy się na realnym dopasowaniu fasonu i świadomym podejmowaniu decyzji zakupowych.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                  <CheckCircle2 size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Rekomendacje dopasowane do okazji</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Każda porada uwzględnia kontekst wydarzenia — od formalnego dress code&apos;u po codzienne stylizacje
                  kapsułowe.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4">
                  <Layers size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Wyjaśnienie, dlaczego stylizacja pasuje</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Nie tylko pokazujemy ubrania, ale tłumaczymy zasady optycznego modelowania proporcji
                  (np. dekolt w serek, linia empire, cięcia w talii).
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                  <Shield size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Inspiracje ze wskazaniem źródła</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Prezentowane propozycje posiadają jasne odnośniki do sklepów źródłowych, ułatwiając sprawdzenie
                  dostępności i ceny bezpośrednio u sprzedawcy.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center mb-4">
                  <Shirt size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Rozwijana wirtualna przymierzalnia</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Eksperymentalny moduł wirtualnej przymierzalni jest udostępniany w kontrolowanych warunkach
                  dla zweryfikowanych zdjęć produktów.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Transparentność wersji beta */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-950/40 via-violet-950/30 to-slate-900/40 border border-indigo-500/20 rounded-3xl p-8 sm:p-10 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-1">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Transparentność i faza beta</h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-4">
                  Stylistka 2026 jest projektem technologicznym w fazie ciągłego rozwoju. Rekomendacje generowane przez
                  algorytmy sztucznej inteligencji mogą wymagać własnej oceny i weryfikacji przez użytkownika. Dostępność
                  niektórych funkcji jest uzależniona od źródła danych oraz typu odzieży.
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-indigo-400" /> Ciągłe ulepszanie algorytmów
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-indigo-400" /> Kontrola prywatności danych
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-indigo-400" /> Uczciwe oznaczanie inspiracji
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Dla partnerów handlowych */}
        <section id="partnerzy" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-2 block">
              Ekosystem e-commerce
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Technologia, która łączy inspirację z zakupem
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-6">
              Nasza platforma pomaga konsumentom odkrywać trafne fasony ubrań, a w kolejnym kroku kieruje ich
              do oficjalnych sklepów internetowych poprzez odpowiednio oznaczone linki partnerskie.
            </p>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
              Niektóre linki do produktów mogą w przyszłości mieć charakter afiliacyjny. Cena dla użytkownika
              nie wzrasta z tego powodu.
            </div>
          </div>
        </section>

        {/* Section: FAQ */}
        <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase mb-2 block">
                Odpowiedzi na pytania
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Często zadawane pytania
              </h2>
            </div>

            <div className="space-y-4">
              {/* Pytanie 1 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                  Na jakim etapie znajduje się Stylistka 2026?
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Stylistka 2026 jest dostępna w rozwijanej wersji beta. Podstawowe funkcje analizy i rekomendacji są już dostępne, a kolejne elementy są stopniowo testowane i optymalizowane pod kątem jakości, bezpieczeństwa oraz wygody użytkowników.
                </p>
              </div>

              {/* Pytanie 2 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                  Czy analiza AI zawsze jest bezbłędna?
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Nie. Choć algorytm analizuje proporcje z dużą starannością, wyniki mają charakter inspiracyjny
                  i rekomendacyjny. Ostateczny wybór fasonu i rozmiaru należy zawsze do użytkownika.
                </p>
              </div>

              {/* Pytanie 3 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                  Co dzieje się z przesłanym zdjęciem?
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Zdjęcie jest przesyłane do infrastruktury aplikacji oraz odpowiedniego dostawcy usługi AI w celu wykonania wybranej funkcji. Sposób i czas przetwarzania zależą od użytej funkcji. Wynik wirtualnej przymiarki może zostać zapisany jako cache powiązany z kontem użytkownika. Szczegóły opisuje Polityka prywatności.
                </p>
              </div>

              {/* Pytanie 4 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                  Czy wszystkie ubrania można wirtualnie przymierzyć?
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Nie. Moduł wirtualnej przymierzalni wymaga zweryfikowanych zdjęć produktów przedstawiających odzież na jednolitym tle, aby zapewnić odpowiednią jakość wizualizacji i nie zniekształcać sylwetki. Zdjęcia inspiracyjne z wyszukiwarki nie są kierowane do modułu przymierzalni.
                </p>
              </div>

              {/* Pytanie 5 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                  Czy linki do sklepów mogą być afiliacyjne?
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Tak, w przyszłości część odnośników produktowych może wykorzystywać programy partnerskie. Przejście
                  przez taki link nie wiąże się z żadnymi dodatkowymi kosztami ani wyższą ceną dla kupującego.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Bar */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Gotowy sprawdzić swoje rekomendacje?
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mb-8 max-w-xl mx-auto">
              Przejdź do studia Stylistki 2026 i przetestuj analizę sylwetki w środowisku beta.
            </p>
            <Link
              href="/studio"
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-4 px-8 rounded-xl transition-all shadow-xl shadow-indigo-600/25 active:scale-95 text-base"
            >
              Wypróbuj wersję beta
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-400 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <span className="font-bold text-slate-200 text-sm">Stylistka 2026</span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">
              Wersja beta
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/studio" className="hover:text-white transition-colors">
              Przejdź do studia
            </Link>
            <Link href="/polityka-prywatnosci" className="hover:text-white transition-colors">
              Polityka prywatności
            </Link>
            <Link href="/zasady-korzystania" className="hover:text-white transition-colors">
              Zasady korzystania
            </Link>
            <Link href="/informacja-o-afiliacji" className="hover:text-white transition-colors">
              Informacja o afiliacji
            </Link>
          </div>

          <p className="text-slate-500 text-[11px] text-center md:text-right">
            Projekt fashion-tech. Rekomendacje algorytmiczne.
          </p>
        </div>
      </footer>
    </div>
  );
}
