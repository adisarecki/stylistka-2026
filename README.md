# Stylistka 2026

## Zespół Projektowy i Role
Projekt jest owocem współpracy trzech filarów, które gwarantują synergię między technologią, sercem a jakością:
- **Wizjoner (Serce)**: Wyznacza kierunek artystyczny i definiuje potrzeby estetyczne użytkownika. Jest spiritus movens projektu.
- **Antigravity (Wynalazca/Developer)**: Agentic AI odpowiedzialne za inżynierię, wdrożenie multimodalne i architekturę systemową.
- **Mentor (Strażnik Jakości)**: Dba o standardy, bezkompromisowość porad i spójność dokumentacji z rzeczywistością.

## Opis
Stylistka 2026 to zaawansowana aplikacja webowa typu "AI Personal Stylist", która wykorzystuje multimodalne modele językowe (Google Gemini 2.0 Flash) do analizy sylwetki użytkownika na podstawie zdjęcia. System rozpoznaje proporcje ciała i generuje spersonalizowane porady stylizacyjne w czasie rzeczywistym.

## Fashion Intelligence (Logika "Vision")

Model Gemini 2.0 Flash działa w trybie **Expert Stylist**. Interpretacja obrazu nie opiera się na prostych tagach, lecz na głębokiej analizie geometrycznej przesłanego zdjęcia:

### Parametry Analizy Proporcji
Model mapuje każdą sylwetkę do jednej z 5 formalnych kategorii:
1. **JABŁKO (XXL/O)**: Szeroki tułów, brak wcięcia w talii. System stosuje strategię maskującą (Empire).
2. **GRUSZKA (A)**: Biodra szersze od ramion, wyraźna talia.
3. **KLEPSYDRA (X)**: Ramiona i biodra tej samej szerokości, wyraźne wcięcie w talii.
4. **KOLUMNA (H)**: Ramiona i biodra tej samej szerokości, brak wyraźnego wcięcia w talii, szczupła budowa.
5. **ROŻEK (V)**: Ramiona szersze od bioder, wąska miednica.

### Expert Filter (Dynamiczne Wzmocnienie)
W przypadku wykrycia sylwetki typu **JABŁKO**, system automatycznie wzmacnia zapytanie do wyszukiwarki o frazy `+empire +maskująca talia`. Gwarantuje to, że propozycje produktowe są ściśle dopasowane do strategii maskującej zalecanej przez AI.

## Struktura API i Filtrowanie Produktów

Aplikacja wykorzystuje precyzyjne, techniczne zapytania, aby wyeliminować szum informacyjny i redundancję.

### Personalizacja Płci (Gender Selector)
Przed uruchomieniem analizy użytkownik musi określić, dla kogo szuka ubrań (Kobieta / Mężczyzna / Inne). Parametr ten jest wstrzykiwany bezpośrednio do promptu dla Gemini, dzięki czemu sztuczna inteligencja precyzyjnie dobiera typ i fason odzieży (np. proponując męski garnitur zamiast damskiej marynarki), co drastycznie podnosi trafność generowanego `apiQuery`.

### Endpoint `/api/products` (Serper.dev)
System generuje `apiQuery` dla silnika **Serper.dev** (Google Images via JSON API), który jest następnie wzbogacany o filtry dynamiczne:
- **Silnik**: Serper.dev jest naszym jedynym i głównym silnikiem wyszukiwania produktów. Eliminujemy tym samym potrzebę konfiguracji Google Cloud Custom Search.
- **Logika Filtrów**:
  - `+site:zalando.pl | site:answear.com | site:modivo.pl`: Ograniczenie wyników do sprawdzonych platform modowych.
  - `-buty -torebka -szpilki`: Wykluczanie akcesoriów, by skupić się na odzieży.
- **Dynamiczne Wzmocnienie (Expert Filter)**: 
  - Jeśli `figureType === 'JABŁKO'`, system w locie dopisuje frazy `+empire +maskująca talia`.
  - **Mechanizm Graceful Fallback**: W przypadku, gdy twardy filtr rozmiaru nie zwróci żadnych wyników, system automatycznie ponawia zapytanie bez filtra rozmiaru. Użytkownik otrzymuje wtedy propozycje alternatywne wraz z czytelnym komunikatem w UI: „Brak Twojego rozmiaru w głównych propozycjach...”. Gwarantuje to ciągłość UX i zawsze dostarcza wartościową inspirację modową.
  - Dzięki temu użytkownik otrzymuje wyniki, które fizycznie realizują porady AI stylistki i są dostępne w jego rozmiarze lub stanowią najlepszą alternatywę fasonową.

### Moduł Lokalny Pomost (Faza 1.5)
Aplikacja została wzbogacona o hybrydowe wyniki wyszukiwania wspierające lokalne biznesy:
- **Kontekst Lokalizacji**: Użytkownik może wpisać swoje miasto lub użyć geolokalizacji w nowym nagłówku (`LocationHeader`).
- **Wstrzykiwanie Partnerów (Premium UI)**: Karuzela wstrzykuje wyselekcjonowane "Lokalne Perełki" (partnerskie butiki z okolicy) pomiędzy standardowe wyniki z sieciówek.
- **Konwersja O2O (Online to Offline)**: Lokalne oferty posiadają złote akcenty premium, znacznik odległości (np. "2.5 km od Ciebie") oraz bezpośrednie odnośniki do zewnętrznych miejsc w sieci (np. profil Facebook butiku), a także opcje wytyczenia trasy lub telefonu do salonu.

### Uniwersalny Standard Rozmiarów (Mapping)
Aplikacja wykorzystuje połączony standard międzynarodowy i europejski dla maksymalnej precyzji:

| Rozmiar Int | Rozmiar EU (Backend Value) |
|-------------|----------------------------|
| **XS**      | 34                         |
| **S**       | 36                         |
| **M**       | 38                         |
| **L**       | 40                         |
| **XL**      | 42                         |
| **XXL**     | 44                         |

*System przesyła do silnika Serper.dev wyłącznie wartość numeryczną EU, co optymalizuje wyniki w sklepach takich jak Zalando czy Modivo.*

## Troubleshooting: Billing & Cloud

Jeśli system zgłasza błędy limitów (Quota) lub brak dostępu do Custom Search w Google Cloud, należy wykonać następujące kroki:

### Przypięcie Konta Rozliczeniowego
Nasza „polisa ubezpieczeniowa” to Billing Account ID: **01A30A-587CA2-4E6028**.
1. Przejdź do [GCP Billing Console](https://console.cloud.google.com/billing).
2. Wybierz projekt „Stylistka 2026”.
3. Kliknij „Link a billing account”.
4. Wybierz powyższy ID z listy dostępnych kont.
5. Zrestartuj usługi w Google AI Studio, aby odświeżyć limity dla modelu Gemini.

## Stack technologiczny
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4.0.
- **AI:** Google Gemini 2.0 Flash (Multimodal), Serper.dev (Search), Replicate (IDM-VTON).

## Struktura projektu
- `/app/api/analyze`: Mózg AI – multimodalna analiza i kategoryzacja.
- `/app/api/products`: Serce zakupów – filtrowany silnik Serper.dev.
- `/app/api/try-on`: Laboratorium – generowanie wirtualnej przymiarki.

> [!TIP]
> **UWAGA**: Moduł Wirtualnej Przymierzalni (IDM-VTON) został wybudzony (Wersja Beta) i zintegrowany z interfejsem aplikacji! Wymaga on poprawnej konfiguracji tokenu Replicate.

## UI Components System

### Visual Advice Cards
System prezentacji werdyktów AI został oparty na wysokiej jakości komponentach "Advice Cards":
- **Design**: Wykorzystanie **Glassmorphism** (bg-white/10, backdrop-blur-md) dla uzyskania premium looku.
- **Ikony Kontekstowe**: 
    - ✨ **Twój Atut**: Gwiazda (Star) symbolizująca naturalne piękno.
    - 💎 **Złota Porada**: Korona (Crown) reprezentująca ekspercką wiedzę stylistyczną.
    - 🛑 **Unikaj**: Ośmiokąt (OctagonX) jako czytelny sygnał ostrzegawczy.
- **Interakcja**: Subtelne efekty hover (skalowanie, rozjaśnienie tła) oraz płynne animacje wejścia (`animate-fade-in-up`).

### Narzędzia Kontroli Jakości (Internal Tools)
Projekt zawiera dedykowane skrypty do weryfikacji jakości analiz AI oraz silnika zakupowego:
- `compare-vision.js`: Automatyczne porównanie werdyktów AI dla różnych typów sylwetek (np. Apple vs Slim) na podstawie obrazów testowych. Wyniki są zapisywane do `test-results.json`.
- `test-expert.js`: Skrypt do jednostkowego testowania logiki "Expert Stylist" dla konkretnych przypadków brzegowych.

Uruchamianie testów: `node [nazwa-skryptu].js` (wymaga uruchomionego serwera lokalnego na porcie 3000).

## Wdrożenie Produkcyjne i CI/CD (Vercel)

Aplikacja jest dostępna pod adresem: **[https://stylistka-2026.vercel.app](https://stylistka-2026.vercel.app)**

Projekt **Stylistka 2026** korzysta z modelu ciągłego wdrażania (**Continuous Deployment**) poprzez integrację z repozytorium GitHub.

### Automatyczne Aktualizacje
Każda zmiana wypchnięta do głównej gałęzi repozytorium (`git push origin main`) wyzwala automatyczny proces **Auto-Deploy** na platformie Vercel. Oznacza to, że poprawki, nowe rozmiary czy optymalizacje silnika Vision trafiają do sieci bezszwowo.

### Konfiguracja Środowiska (Klucze API)
Przed pierwszą aktualizacją produkcyjną lub w przypadku zmiany kluczy, należy upewnić się, że w panelu Vercel (**Settings -> Environment Variables**) skonfigurowane są następujące zmienne:

| Klucz Środowiskowy      | Opis                                      |
|-------------------------|-------------------------------------------|
| `GOOGLE_API_KEY`        | Klucz AI (Gemini / Google AI Studio)      |
| `REPLICATE_API_TOKEN`   | Token do obsługi modeli Replicate (VTON)  |
| `SERPER_API_KEY`        | Klucz do silnika wyszukiwania Serper.dev  |

> [!IMPORTANT]
> Plik `.env.local` jest automatycznie ignorowany przez Git (`.gitignore`). Klucze produkcyjne muszą zostać wprowadzone ręcznie w panelu Vercel, aby systemy AI i wyszukiwarka mogły poprawnie funkcjonować po wdrożeniu.

### Kroki Wdrożeniowe:
1. Skonfiguruj zmienne środowiskowe w istniejącym projekcie `stylistka-2026` na Vercel.
2. Wypchnij najnowszy kod komendą: `git push`.
3. Monitoruj status budowania w panelu Vercel (Dashboard).

## Historia Rozwoju (Changelog)

- **Tip Top (Faza 1.5 i Faza 2.0)**: 
  - **Naprawa usterki (O2O)**: Linki "Lokalnych Perełek" w karuzeli od teraz poprawnie zintegrowane i otwierają zewnętrzne strony (np. Facebook) w nowych kartach.
  - **Wirtualna Przymierzalnia (VTON Beta)**: Wybudzono funkcjonalność przymierzalni IDM-VTON. Dodano przycisk "Przymierz" z dynamicznym wstrzykiwaniem kategorii ubioru do modelu Replicate.
  - **Dynamiczne Rozmiary**: Wyrównano skale i wartości wejściowe zależnie od kategorii wykrytego produktu.
  - **Smart UI & Geolokalizacja**: Usunięto inwazyjne filtry płci oraz potwierdzono poprawną kaskadę Fallback dla określania bieżącej lokalizacji użytkownika.

- **2026-02-26**: 
  - Wdrożenie modułu **Lokalny Pomost (Faza 1.5)**: Header geolokalizacji, wstrzykiwanie "Lokalnych Perełek" z bazą butików offline do karuzeli w celach O2O.
  - Implementacja **Złotej Zasady Ostrości (Vision Focus)** w prompcie: AI dynamicznie analizuje proporcje góry lub dołu ciała w zależności od szukanego typu ubrania.
  - Wprowadzenie **Logiki Kategorii & Dynamicznego Selektora Rozmiarów**: Rozmiarówka dostosowuje się (EU_CLOTHES, EU_SHOES, One Size) pod rozpoznaną przez AI/wyszukiwarkę kategorię.
  - **Automatyczne Rozpoznawanie Płci**: Inteligencja AI samodzielnie wykrywa płeć po prompcie, a manualny przełącznik przeniesiono do "Opcji zaawansowanych".
  - **Inteligentna Kaskada Geolokalizacji**: Wbudowano logikę ustalania lokalizacji użytkownika metodą GPS -> IP (GeoJS API) -> Domyślny fallback (Będzin / Śląsk), z opcją ręcznego nadpisania w `LocationHeader`.

---
*Dokumentacja aktualizowana regularnie pod nadzorem Mentora, zgodnie z wizją Wizjonera i wdrożona przez Antigravity.*
#   s t y l i s t k a - 2 0 2 6  .
 
 