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

| Klucz Środowiskowy                           | Opis                                           |
|-----------------------------------------------|-------------------------------------------------|
| `REPLICATE_API_TOKEN`                         | Token do obsługi modeli Replicate (VTON)       |
| `SERPER_API_KEY`                              | Klucz do silnika wyszukiwania Serper.dev       |
| `GEMINI_API_KEY`                              | Klucz AI (Gemini / Google AI Studio)           |
| `NEXT_PUBLIC_FIREBASE_API_KEY`                | Klucz API Firebase (Web)                       |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`            | Domena autoryzacji Firebase Auth               |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`             | ID projektu Firebase                           |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`         | Bucket Storage Firebase                        |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`    | Sender ID Firebase Cloud Messaging             |
| `NEXT_PUBLIC_FIREBASE_APP_ID`                 | App ID Firebase Web                            |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`         | ID Google Analytics (opcjonalny)               |

> [!CAUTION]
> **Formatowanie kluczy:** Wartości zmiennych w panelu Vercel **NIE mogą** zawierać cudzysłowów (`"`), spacji ani przecinków. Wklejaj surowe wartości, np. `AIzaSyD64hk...` a **nie** `"AIzaSyD64hk..."`. Złe formatowanie powoduje `auth/invalid-api-key`.

> [!IMPORTANT]
> Plik `.env.local` jest automatycznie ignorowany przez Git (`.gitignore`). Klucze produkcyjne muszą zostać wprowadzone ręcznie w panelu Vercel, aby systemy AI i wyszukiwarka mogły poprawnie funkcjonować po wdrożeniu.

### Kroki Wdrożeniowe:
1. Skonfiguruj zmienne środowiskowe w istniejącym projekcie `stylistka-2026` na Vercel.
2. Wypchnij najnowszy kod komendą: `git push`.
3. Monitoruj status budowania w panelu Vercel (Dashboard).

- **Oszczędzanie Zasobów VTON (Firestore VTON Cache)**: System wirtualnej szatniarz zyskał wspaniałą integrację kliencką Firebase (V9) w obrębie plików `/api/try-on/route.ts`. Przed rozpoczęciem jakikolwiek kosztownych autoryzacji modelów VTON, obraz ze skanera powiązany ze zdjęciem produktowym sklepu, wybranym wariantem ubrań i precyzyjnym promptem - formuje się w dedykowany String hashowany jako *MD5*. Po odnalezieniu istniejących już prac pod tym ID *Firestore -> vton_cache* - pomija Mutex 429 i procedury w Replicate błyskawicznie zwracając wygenerowany zarys.
- **Ominięcie SSL/403 Image Proxy & Strict Global Lock**: By pokonać mur blokad *Cloudflare* oraz *HTTP 403 Forbidden* wynikający z ochrony zaplecza graficznego potężnych dyskontów odzieżowych (Zalando, Mango etc.), VTON Endpoint `/api/try-on` asymiluje pliki zdalnie używając mechanizmu "Image Proxy". Node.js pobiera paczkę `ArrayBuffer` a następnie transformuje na wektor binarny by natychmiast wrzucić go do **Firebase Storage** za pomocą autoryzacji Google. Następnie generuje dedykowany link `getDownloadURL` pobierany ostatecznie przez sam model sztucznej inteligencji omijając firewalle sklepów. Wdrożony we wcześniejszych etapach *Mutex* od dziś znany jako `isAppProcessing`, stał się w całości globalnym systemem na bazie blokad kolekcyjnych `active_sessions` wspieranych na Cloud Firestore - twardo ryglując każde kliknięcie w sesji w Vercelu.
- **Zalando Size Engine z Profilowaniem Użytkownika**: W komponencie `TryOnWidget.tsx` usunięto klasyczny wybór rozmiarów na rzecz pola **"Obwód Klatki Piersiowej (cm)"**. Aplikacja mapuje te wartości na referencyjne skale rozmiarów rynkowych **Zalando**. Wyliczony rozmiar informuje użytkownika suchym werdyktem i sprytnie proponuje rozmiary sąsiadujące ("rozmiar up" do większego zapasu tkaniny oraz "rozmiar down"). Równolegle - wyliczenia łączą się pod spodem z autogenerowanym ciasteczkiem `userId`, zapisując rozmiary bez czekania asynchronicznie poprzez `/api/user-profile` do natywnej kolekcji `users` na Firebase gwarantując w ten sposób pełen ślad behawioralny i tworzenia kart stałego klienta. Zastąpiono przestarzałe żółte alerty estetycznym monitorem propozycji.
- **Parametryczna Wyszukiwarka Produktowa (Silnik Zapytań Serper.dev)**: By wykluczyć niechciane środowisko na zdjęciach w tle przy przymiarce (np. plener z modelką pobrany z Google Images dla VTON), prompt do AI Gemini został przeorganizowany (zwraca teraz stałe parametry ubrań: kolor, typ, krój, okazja obok standardowej frazy). Z kolei w backendzie `/api/products` silnik odciął się od potokowego dopasowywania obrazów polegając na "żelaznym" schemacie dodającym twarde `+` (np. `+czerwony +sukienka +mini site:zalando.pl ...`). Odpowiedź JSON przekazuje również `garmentMetadata` użyteczną do VTON.
- **PRECYZYJNA WYSZUKIWARKA PRODUKTOWA (Retail-Only Filter)**: W oparciu o problem z "śmieciowymi" zdjęciami modelek w plenerze dla modelu VTON, przeprojektowano budowę zapytań API do Google Images (Serper.dev). System ucieka się teraz do twardego Whitelisting'u gigantycznych platform odzieżowych (*Zalando, Answear, Modivo, H&M*) i wykorzystuje operatory wykluczające do eliminacji fotograficznego zaplecza i zdjęć pozowanych (np. `-portfolio -fotografia`). Fraza użytkownika umieszczana jest zawsze w cudzysłowie `""`.
- **Frontend Smart Retry dla VTON (Crash Fix 500)**: Zrezygnowano z izolatora kolejki opartego na łańcuchach obietnic, który ulega rozproszeniu w środowisku _Serverless Vercel_. Na backendzie włączono twarde, szybkie reagowanie, podczas gdy na w `TryOnWidget.tsx` wdrożono niezależny 12-sekundowy mechanizm usypiający klienta (tzw. _Smart Retry_), jeśli wystąpi blokada 429 na Replicate. Zastosowano również "Złoty Loader" z uspokajającym przekazem nt. zaawansowanego procesu AI oraz odpowiednie zablokowanie wielokrotnego użytku przycisku przymiarki.
- **Wymuszenie Packshotów (Serper.dev)**: System poszukiwania produktów w locie modyfikuje zapytanie o asortyment dodając operatory `packshot OR "zdjęcie produktowe" przodem "białe tło"`. Dostarcza to mechanizmowi usuwania tła i API Replicate niemalże sterylne grafiki odzieży, co drastycznie ucina ryzyko dekonstrukcji obrazu lub halucynacji związanej z postaciami na drugim planie.
- **Queue & Rate Limit Handler (Crash Fix 500)**: Zaimplementowano odporność na rygorystyczne limity API Replicate (burst=1). Wdrożono przechwytywanie błędu 429 po stronie serwera zapobiegające awariom całego backendu. Po stronie klienta wprowadzono globalny izolator kolejki oparty na asynchronicznych łańcuchach Promise (`enqueueTryOn`), połączony z blokadą przycisków w UI (`isTryOnLoading -> disabled`). Zapobiega to nakładaniu się zapytań użytkownika podczas prób przymierzenia.
- **Architektura "Szybki Fix" (Pipeline Remove-BG i Stabilizacja)**: Wprowadzenie krytycznej poprawki optymalizującej jakość przymiarki VTON. Uruchomiono pre-processing przesyłanego zdjęcia modowego przez mechanizm usuwania tła (`cjwbw/rembg`). Zintegrowano precyzyjną weryfikację kategorii produktu, nadpisując błędy API z Serper.dev, a samo sterowanie poleceniami do modelu Replicate zostało zablokowane twardymi i powtarzalnymi zmiennymi w Żelaznym Prompcie. Uaktualniono także teksty UI dla lepszego nastroju użytkownika.
- **VTON Control Layer i Żelazny Prompt**: Pełna stabilizacja parametrów wirtualnej przymiarki (IDM-VTON). System pobiera teraz nazwę docelowego produktu (np. "długa sukienka maxi") z karuzeli i wstrzykuje ją jako `productTitle` do backendu. Backend komponuje z wykorzystaniem tych danych powtarzalny "Żelazny Prompt" (blokowanie zmian sylwetki, zakaz modyfikacji twarzy) połączony z poradą stylistyczną, a zniekształcenia są tłumione przez dedykowany `negative_prompt`. Dodano `guidance_scale` i twarde `num_inference_steps`.
- **Agresywne Wymuszenie Tekstu VTON (Fix Minifikacji)**: Bezwzględne rzutowanie adresu URL na String (`String(output)`) na backendzie oraz ponowne zabezpieczenie interpolacją (`${data.imageUrl}`) na frontendzie, co ostatecznie rozwiązuje problem z renderowaniem funkcji `new URL(e)` przez minifikator Vercel. Dodano bezpieczne sprawdzanie przed użyciem znacznika `<img>`.
- **Uproszczenie danych VTON (Fix renderowania URL)**: Wyeliminowano problem z minifikacją Vercel poprzez przejście na czyste ciągi znaków (String) zamiast obiektów `URL` po stronie klienta. Backend zwraca teraz `{ imageUrl: string }`, a frontend renderuje obraz bez zbędnego przetwarzania.
- **Hotfix (VTON UI & Rendering)**: Naprawiono błąd z ucinaniem/renderowaniem obrazów typu `[object Object]` z serwerów Replicate. Przebudowano układ UI – od teraz "Prawdopodobny wygląd" (wygenerowana przymiarka) ląduje z eleganckimi animacjami wprost pod skanerem sylwetki (na lewym panelu).

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

- **2026-03-01 (Wdrożenie Systemów Antykryzysowych, Google Auth i RODO)**:
  - Zaimplementowano **Firebase Authentication (Google Sign-In)** wymuszające autoryzację przed użyciem AI Skanera, z pełnoekranową "Tarczą Prywatności".
  - Wdrożono **Privacy Guard** – baza operuje na Firebase Storage z cyklem życia plików dostosowanym do RODO. Zdjęcie sylwetki znajduje się w chmurze tylko na czas przetwarzania VTON w prywatnym folderze użytkownika (`users/{uid}/...`) i autodelete'uje się przy każdym scenariuszu.
  - Zmieniono architekturę blokad – usunięto globalny lock na rzecz **Per-User Mutex** w Cloud Firestore (`active_sessions/{uid}`), uwalniając równoległe zapytania współbieżnych instancji przy zachowaniu solidnej ochrony przed 429 dla jednego konta.
  - System zyskał nowy, dopieszczony reżim Retry (**Smart Retry**) na froncie: do 5 prób w odstępach 12-sekundowych w locie łagodzący odrzucenia z Replicate API (błąd 429 Rate Limit) z nałożonym usztywnieniem blokującym nieskończone pętle renderów (*React Side-Effect fix*).
  - Wzbogacono silnik **Expert Prompting (Gemini)** o zwracanie parametru `bodyShape` (5 formalnych kategorii typu Jabłko, Gruszka, Rożek itd.) nakładającego automatyczne modyfikatory krojów (np. `+empire +maskująca talia`) prosto do API *idm-vton* na serwerze. Serper nakłada teraz rygorystyczne wytyczne `+packshot +"białe tło"` by omijać fotorealizm.

- **2026-03-01 (Refaktoryzacja IDM-VTON Schema + Hotfix UI Auth)**:
  - **IDM-VTON Strict Schema:** Przepisano `/api/try-on` od zera. Endpoint wysyła teraz wyłącznie oficjalne pola modelu: `human_img` (Firebase Storage link), `garm_img` (proxied przez Storage), `garment_des` (opis + modyfikatory sylwetki), `category` (dynamicznie: `upper_body` / `lower_body` / `dresses`).
  - **Cache-First `try_on_results`:** Zmieniono kolekcję Firestore z `vton_cache` na `try_on_results`. Hash generowany stabilnie z `uid + garm_img URL + productTitle` (niezależny od niestabilnego base64). Wynik `uri` zapisywany po każdym sukcesie – przy ponownej przymiarce tej samej odzieży odpowiedź jest natychmiastowa z bazy.
  - **Hotfix UI Auth:** Usunięto pełnoekranowy bloker logowania. Google Auth migruje teraz do panelu Skanera jako „Tarcza Prywatności" z dużym przyciskiem `Zaloguj z Google`, widocznym obok opcji wgrywania zdjęcia. Karuzela produktów wyświetla dla niezalogowanych przycisk `Zaloguj się z AI` zamiast `Przymierz`.
  - **React Side-Effect Fix:** Przeniesiono wywołanie `fetch('/api/user-profile')` z ciała komponentu do hooka `useEffect`, eliminując nieskończone pętle bombardujące serwer przy każdym re-renderze.

  - **Globalny AuthHeader:** Stworzono komponent `AuthHeader.tsx` (sticky top bar z logo, avatar i wylogowaniem).
  - **AuthGatekeeper (Pełna blokada):** Nowy komponent `AuthGatekeeper.tsx` opakowuje **całą aplikację** w `page.tsx`. Dopóki `onAuthStateChanged` nie zwróci zalogowanego użytkownika, żaden komponent dziecka (TryOnWidget, karuzela, LocationHeader) **nie istnieje w DOM** — zero requestów API, zero renderów, zero 429. Użytkownik widzi wyłącznie ekran z przyciskiem **„Zaloguj się z Google"**.
  - **IDM-VTON Smart Parser:** API dynamicznie rozpoznaje sukienki (`isDress`) na podstawie tytułu odzieży ze sklepu. Dla sukienek automatycznie rzutuje kategorię `dresses`, odpala flagę `force_dc: true` (wymóg schematu Replicate) i dołącza do `garment_des` twardy prompt blokujący halucynacje krótko uciętych nóg i szelek ze zdjęcia bazowego (`"long dress, full body dress, covering legs, highly detailed"`).
  - **Architektura AI-to-AI (Gemini System Architect):** Cały ciężar formułowania payloadu do Replicate przeniesiony został do Inżynierii Wskazówek modelu Gemini w funkcji Skanera Sylwetki. Omija on język polski, porady stylistyczne i zdania - dla każdego wykrytego na zdjęciu ubrania generuje dwa sztywne atrybuty VTON: `replicateCategory` oraz bardzo techniczny `replicatePrompt` (krótkie tagi językowe np. "sleeveless, evening gown").
  - **Przełamywanie Maski IDM-VTON (Brutal Fallback + AI):** Przy napotkaniu sukni dążąc do zniwelowania uciętego tła na udach - to Gemini zaszywa w strumieniu parametr twardy: `, FULL LENGTH MAXI DRESS, COVERING LEGS ENTIRELY DOWN TO THE FLOOR, highly detailed`. Jeśli przesyłka AI zawiedzie, do akcji wkracza wbudowany w `api/try-on/` mechanizm *Brutal Fallback*. Zrzut ten skanuje zawartość payloadu wykrywając synonimy ("suknia", "maxi", "balowa") na polskiej stronie tekstu, nadpisując odgórniej kategorię `dresses`, stawiając `force_dc: true`, oraz doklejając siłowo wymuszający maskę nóg angielski rygor. Proces zabezpieczenia gwarantuje podawanie do generatorów wylącznie The English Tags a crop blokowany jest do okadrowania fałszywego.

---
*Dokumentacja aktualizowana przy każdej ważnej zmianie, pod nadzorem Mentora, zgodnie z wizją Wizjonera i wdrożona przez Antigravity.*
#   s t y l i s t k a - 2 0 2 6  .
 
 