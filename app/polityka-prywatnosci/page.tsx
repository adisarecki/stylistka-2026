import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Eye, Database, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Polityka Prywatności — Stylistka 2026',
  description: 'Zasady przetwarzania danych i ochrony prywatności w wersji beta Stylistka 2026.',
};

export default function PrivacyPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
            <Shield size={12} /> Transparentność i prywatność
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Polityka Prywatności (Wersja Beta)
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Informacja o zasadach przetwarzania danych w eksperymentalnej aplikacji Stylistka 2026.
          </p>
        </header>

        <div className="space-y-8 text-slate-300 text-sm sm:text-base leading-relaxed">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Eye size={18} className="text-indigo-400" /> 1. Cel i charakter usługi
            </h2>
            <p>
              Stylistka 2026 to aplikacja badawczo-rozwojowa (wersja beta) służąca do personalizowanej
              analizy sylwetki i doboru inspiracji modowych za pomocą sztucznej inteligencji. Usługa nie
              stanowi doradztwa medycznego, zdrowotnego ani gwarancji idealnego dopasowania odzieży.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Database size={18} className="text-indigo-400" /> 2. Przetwarzanie zdjęć i zewnętrzni dostawcy AI
            </h2>
            <p className="mb-3">
              Zdjęcia przesyłane do analizy sylwetki i modułu wirtualnej przymierzalni są przekazywane do zewnętrznych
              dostawców usług sztucznej inteligencji wyłącznie w celu wykonania wybranej przez użytkownika operacji:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 text-sm">
              <li>
                <strong>Analiza sylwetki (Google Gemini):</strong> Zdjęcie sylwetki jest przesyłane bezpośrednio z serwera aplikacji do usługi Google Gemini w celu geometrycznej analizy proporcji i wygenerowania porad fasonowych.
              </li>
              <li>
                <strong>Wirtualna przymierzalnia (Replicate):</strong> Zdjęcie sylwetki jest tymczasowo umieszczane w magazynie Firebase Storage w celu wygenerowania bezpiecznego, ograniczonego czasowo adresu URL przekazywanego do modelu w usłudze Replicate. Po zakończeniu przetwarzania w bloku finalizującym podejmowana jest próba usunięcia pliku źródłowego sylwetki z magazynu, jednak kod aplikacji nie gwarantuje bezwzględnego usunięcia w razie twardej awarii procesu serwerowego.
              </li>
              <li>
                <strong>Zewnętrzni dostawcy AI:</strong> Aplikacja korzysta z usług zewnętrznych (Google Gemini oraz Replicate) i nie kontroluje samodzielnie technicznej retencji ani wewnętrznych procedur usuwania danych po stronie tych dostawców. Przetwarzanie danych przez dostawców zewnętrznych podlega ich własnym warunkom i politykom prywatności.
              </li>
              <li>
                <strong>Pamięć podręczna wyników (Cache):</strong> Wygenerowane gotowe obrazy przymiarki są zapisywane w magazynie chmurowym jako pamięć podręczna (cache) powiązana z kontem użytkownika, aby zapobiegać ponownemu pobieraniu kredytów przy identycznych parametrach.
              </li>
              <li>
                <strong>Dostęp do wygenerowanych obrazów:</strong> Adresy URL do wygenerowanych wyników są adresami podpisanymi (Signed URL) z ograniczonym czasem ważności (15 minut). Adres taki ma charakter identyfikatora dostępowego (bearer URL) i pozwala na odczyt pliku w czasie jego ważności każdemu, kto posiada bezpośredni link.
              </li>
              <li>
                Aplikacja nie publikuje przesyłanych zdjęć ani nie udostępnia ich publicznie w otwartych galeriach.
              </li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Lock size={18} className="text-indigo-400" /> 3. Uwierzytelnianie i profil użytkownika
            </h2>
            <p>
              Logowanie odbywa się za pośrednictwem usługi Google Firebase Authentication. Aplikacja przetwarza
              jedynie podstawowe dane profilowe przekazane przez dostawcę tożsamości (adres e-mail, identyfikator
              użytkownika UID, publiczną nazwę) w celu zarządzania sesją, ochroną przed nadużyciami oraz portfelem
              bezpłatnych kredytów przymiarki.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-3">4. Prawa użytkownika</h2>
            <p>
              Użytkownik ma prawo w dowolnym momencie wylogować się z serwisu, zaprzestać korzystania z aplikacji
              oraz zażądać usunięcia powiązanych danych sesyjnych.
            </p>
          </section>

          <p className="text-xs text-slate-500 pt-4 border-t border-white/10">
            Uwaga: Niniejszy dokument stanowi zarys informacyjny funkcjonowania wersji testowej (beta) i podlega
            uzupełnieniu przed pełnym wdrożeniem komercyjnym.
          </p>
        </div>
      </div>
    </main>
  );
}
