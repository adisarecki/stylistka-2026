import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// 1. / zawiera publiczny landing
// ---------------------------------------------------------------------------
test('1. Landing Page Contract: app/page.tsx reprezentuje publiczny landing page, a nie bezpośrednio skaner', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  assert.ok(fs.existsSync(pagePath), 'app/page.tsx musi istnieć');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /<header/, 'Landing page musi posiadać semantyczny header');
  assert.match(code, /<main/, 'Landing page musi posiadać semantyczny main');
  assert.match(code, /<footer/, 'Landing page musi posiadać semantyczny footer');
  assert.match(code, /<h1/, 'Landing page musi posiadać nagłówek h1');
  assert.doesNotMatch(code, /<TryOnWidget/, 'Landing page nie może bezpośrednio renderować TryOnWidget');
  assert.doesNotMatch(code, /<AuthGatekeeper/, 'Landing page nie może bezpośrednio blokować użytkownika przez AuthGatekeeper');
});

// ---------------------------------------------------------------------------
// 2. /studio zawiera właściwy interfejs aplikacji
// ---------------------------------------------------------------------------
test('2. Studio Contract: app/studio/page.tsx montuje interfejs narzędzia Stylistki', () => {
  const studioPath = path.resolve(process.cwd(), 'app/studio/page.tsx');
  assert.ok(fs.existsSync(studioPath), 'app/studio/page.tsx musi istnieć');
  const code = fs.readFileSync(studioPath, 'utf8');

  assert.match(code, /import TryOnWidget from ["']@\/components\/TryOnWidget["']/, 'Studio musi importować TryOnWidget');
  assert.match(code, /import MarketHeader from ["']@\/components\/MarketHeader["']/, 'Studio musi importować MarketHeader');
  assert.match(code, /import AuthHeader from ["']@\/components\/AuthHeader["']/, 'Studio musi importować AuthHeader');

  assert.doesNotMatch(code, /<AuthGatekeeper>/, 'Studio nie może blokować interfejsu przez AuthGatekeeper przed analizą');
  assert.match(code, /<TryOnWidget\s*\/>/, 'Studio musi renderować TryOnWidget');
});

// ---------------------------------------------------------------------------
// 3. CTA prowadzi dokładnie do /studio
// ---------------------------------------------------------------------------
test('3. CTA Destination: główne przyciski akcji na landing page prowadzą bezpośrednio do /studio', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /href="\/studio"/, 'Landing page musi zawierać link do "/studio"');
  assert.match(code, /Wypróbuj wersję beta/, 'Landing page musi zawierać treść CTA "Wypróbuj wersję beta"');
});

// ---------------------------------------------------------------------------
// 4. Landing zawiera jasne oznaczenie wersji beta
// ---------------------------------------------------------------------------
test('4. Beta Labeling: landing page komunikuje wersję beta w hero, badge i stopce', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /Wersja beta/, 'Landing page musi zawierać oznaczenie "Wersja beta"');
  assert.match(code, /Wersja beta[\s\S]*?Technologia modowa AI/, 'Hero musi zawierać zaktualizowany badge "Wersja beta | Technologia modowa AI"');
});

// ---------------------------------------------------------------------------
// 5. Landing nie zawiera Answear ani Awin
// ---------------------------------------------------------------------------
test('5. Partner Safety: landing page oraz podstrony nie zawierają nazw i logotypów Answear ani Awin', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const privacyPath = path.resolve(process.cwd(), 'app/polityka-prywatnosci/page.tsx');
  const termsPath = path.resolve(process.cwd(), 'app/zasady-korzystania/page.tsx');
  const affiliatePath = path.resolve(process.cwd(), 'app/informacja-o-afiliacji/page.tsx');

  const filesToCheck = [pagePath, privacyPath, termsPath, affiliatePath];

  for (const f of filesToCheck) {
    const content = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(content, /answear/i, `Plik ${f} nie może zawierać nazwy Answear`);
    assert.doesNotMatch(content, /awin/i, `Plik ${f} nie może zawierać nazwy Awin`);
  }
});

// ---------------------------------------------------------------------------
// 6. Landing nie zawiera fałszywych statystyk, opinii i partnerów
// ---------------------------------------------------------------------------
test('6. Trust & Authenticity: brak fałszywych statystyk, zmyślonych opinii i fikcyjnych partnerów', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.doesNotMatch(code, /\b\d{2,}\s*%\s*(zadowolonych|skuteczności)/i, 'Zakaz fałszywych wskaźników procentowych');
  assert.doesNotMatch(code, /\b\d+[\s.]*(tys|k|000)\s*(użytkowników|klientów)/i, 'Zakaz fałszywych liczników użytkowników');
  assert.doesNotMatch(code, /gwiazdek|opinia klient/i, 'Zakaz fałszywych opinii lub ocen gwiazdkowych');
  assert.doesNotMatch(code, /zaufało nam|nasi partnerzy/i, 'Zakaz fałszywych deklaracji o partnerstwach');
});

// ---------------------------------------------------------------------------
// 7. Landing nie inicjuje wywołań endpointów API podczas renderowania
// ---------------------------------------------------------------------------
test('7. Zero Render API Calls: render landing page nie wywołuje żadnych płatnych ani wewnętrznych endpointów API', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.doesNotMatch(code, /\/api\/try-on/, 'Landing page nie może wywoływać /api/try-on');
  assert.doesNotMatch(code, /\/api\/analyze/, 'Landing page nie może wywoływać /api/analyze');
  assert.doesNotMatch(code, /\/api\/products/, 'Landing page nie może wywoływać /api/products');
  assert.doesNotMatch(code, /\/api\/user-profile/, 'Landing page nie może wywoływać /api/user-profile');
  assert.doesNotMatch(code, /authenticatedFetch/, 'Landing page nie może używać authenticatedFetch');
});

// ---------------------------------------------------------------------------
// 8. Publiczne teksty nie zawierają niepotwierdzonych obietnic automatycznego usuwania zdjęć
// ---------------------------------------------------------------------------
test('8. Photo Retention Accuracy: brak niepotwierdzonych obietnic natychmiastowego lub gwarantowanego usuwania zdjęć w UI', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.doesNotMatch(code, /automatycznie usuwane po przymiarce/i, 'Zakaz niepopartego twierdzenia o automatycznym usuwaniu w UI');
  assert.doesNotMatch(code, /usuwane natychmiast/i, 'Zakaz obietnicy natychmiastowego usunięcia w UI');
  assert.doesNotMatch(code, /nie są przechowywane/i, 'Zakaz twierdzenia że obrazy nie są przechowywane (gdy wyniki VTON są cacheowane)');
  assert.match(code, /Sposób i czas przetwarzania zależą od użytej funkcji/, 'Wymagane rzetelne odesłanie do Polityki prywatności w FAQ');
});

// ---------------------------------------------------------------------------
// 9. Nie istnieje fallback heroImage -> VTON
// ---------------------------------------------------------------------------
test('9. VTON Security Boundary: brak jakiegokolwiek fallbacku heroImage -> VTON w ShoppingCarousel', () => {
  const carouselPath = path.resolve(process.cwd(), 'components/ShoppingCarousel.tsx');
  const code = fs.readFileSync(carouselPath, 'utf8');

  assert.match(code, /const\s+canTryOn\s*=\s*hasVerifiedTryOnAsset\(product\)/);
  assert.match(code, /onSelectProduct\(\s*product\.tryOnAsset\.image\.url/);

  assert.doesNotMatch(code, /onSelectProduct\(\s*product\.heroImage\.url/);
  assert.doesNotMatch(code, /tryOnAsset.*\|\|\s*product\.heroImage/);
});

// ---------------------------------------------------------------------------
// 10. Publiczne treści VTON nie sugerują, że każde ubranie można przymierzyć
// ---------------------------------------------------------------------------
test('10. VTON Honest Scope: publiczne treści wyjaśniają, że przymierzalnia wymaga zweryfikowanych zdjęć produktów', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /Czy wszystkie ubrania można wirtualnie przymierzyć\?/, 'FAQ musi zawierać pytanie o zakres przymierzalni');
  assert.match(code, /wymaga zweryfikowanych zdjęć produktów/, 'Odpowiedź musi precyzować wymóg zweryfikowanych zdjęć produktów');
  assert.match(code, /odzież na jednolitym tle/, 'Odpowiedź musi używać zrozumiałego języka ("odzież na jednolitym tle") zamiast technicznego żargonu');
  assert.doesNotMatch(code, /packshoty/, 'Zabronione użycie hermetycznego słowa "packshoty" w publicznym FAQ');
  assert.doesNotMatch(code, /generator VTON/, 'Zabronione użycie hermetycznego słowa "generator VTON" w publicznym FAQ');
  assert.doesNotMatch(code, /zweryfikowane assety/, 'Zabronione użycie technicznego określenia "zweryfikowane assety"');
});

// ---------------------------------------------------------------------------
// 11. Polityka informuje o zewnętrznych dostawcach AI
// ---------------------------------------------------------------------------
test('11. External AI Providers Disclosure: polityka informuje o zewnętrznych dostawcach AI', () => {
  const privacyPath = path.resolve(process.cwd(), 'app/polityka-prywatnosci/page.tsx');
  const code = fs.readFileSync(privacyPath, 'utf8');

  assert.match(code, /zewnętrznych\s+dostawców\s+usług\s+sztucznej\s+inteligencji/i, 'Polityka musi informować o zewnętrznych dostawcach AI');
  assert.match(code, /nie kontroluje samodzielnie technicznej retencji/i, 'Polityka musi ujawniać brak kontroli nad retencją po stronie dostawców');
});

// ---------------------------------------------------------------------------
// 12. Polityka wymienia Google Gemini i Replicate
// ---------------------------------------------------------------------------
test('12. Specific Providers Named: polityka prywatności wymienia Google Gemini oraz Replicate', () => {
  const privacyPath = path.resolve(process.cwd(), 'app/polityka-prywatnosci/page.tsx');
  const code = fs.readFileSync(privacyPath, 'utf8');

  assert.match(code, /Google Gemini/, 'Polityka musi wymieniać Google Gemini');
  assert.match(code, /Replicate/, 'Polityka musi wymieniać Replicate');
});

// ---------------------------------------------------------------------------
// 13. Brak twierdzenia „wyłącznie w pamięci procesu” bez informacji o wysłaniu do dostawcy
// ---------------------------------------------------------------------------
test('13. No False Local-Only Claim: brak twierdzenia o przetwarzaniu wyłącznie w pamięci procesu bez wysłania do dostawcy', () => {
  const privacyPath = path.resolve(process.cwd(), 'app/polityka-prywatnosci/page.tsx');
  const code = fs.readFileSync(privacyPath, 'utf8');

  assert.doesNotMatch(code, /wyłącznie w pamięci procesu/i, 'Zakaz twierdzenia że zdjęcia są przetwarzane wyłącznie w pamięci procesu');
  assert.match(code, /Google Gemini/, 'Wymagane ujawnienie przekazywania do Google Gemini');
});

// ---------------------------------------------------------------------------
// 14. Polityka nie obiecuje gwarantowanego usunięcia
// ---------------------------------------------------------------------------
test('14. Realistic Cleanup Disclosure: polityka nie obiecuje bezwzględnej gwarancji usunięcia w razie awarii', () => {
  const privacyPath = path.resolve(process.cwd(), 'app/polityka-prywatnosci/page.tsx');
  const code = fs.readFileSync(privacyPath, 'utf8');

  assert.match(code, /nie gwarantuje bezwzględnego usunięcia w razie twardej awarii/i, 'Polityka musi uczciwie opisywać brak twardej gwarancji');
  assert.doesNotMatch(code, /gwarantujemy natychmiastowe usunięcie/i, 'Zakaz obietnic gwarantowanego usunięcia');
});

// ---------------------------------------------------------------------------
// 15. Informacja o trwałym cache wyniku VTON i bearer Signed URL
// ---------------------------------------------------------------------------
test('15. Durable VTON Cache & Signed URL Nature: polityka informuje o cache wyniku i naturze Signed URL', () => {
  const privacyPath = path.resolve(process.cwd(), 'app/polityka-prywatnosci/page.tsx');
  const code = fs.readFileSync(privacyPath, 'utf8');

  assert.match(code, /pamięć podręczna \(cache\) powiązana z kontem użytkownika/i, 'Polityka musi ujawniać trwały cache wyniku VTON');
  assert.match(code, /Signed URL/i, 'Polityka musi informować o Signed URL');
  assert.match(code, /bearer URL/i, 'Polityka musi precyzować charakter bearer URL');
});

// ---------------------------------------------------------------------------
// 16. FAQ nie przeczy polityce prywatności
// ---------------------------------------------------------------------------
test('16. FAQ Consistency: FAQ na landing page jest spójne z polityką prywatności', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /odpowiedniego dostawcy usługi AI/, 'FAQ musi potwierdzać przesyłanie do dostawcy AI');
  assert.match(code, /Wynik wirtualnej przymiarki może zostać zapisany jako cache/, 'FAQ musi potwierdzać zapis cache');
  assert.match(code, /Szczegóły opisuje Polityka prywatności/, 'FAQ musi odsyłać do Polityki prywatności');
});

// ---------------------------------------------------------------------------
// 17. Viewport Safety: overflow-x-hidden
// ---------------------------------------------------------------------------
test('17. Viewport Safety: główny kontener strony posiada zabezpieczenia przed poziomym overflow (overflow-x-hidden)', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /overflow-x-hidden/, 'Główny kontener HomePage musi posiadać klasę overflow-x-hidden');
});

// ---------------------------------------------------------------------------
// 18. Responsive Grids: siatki sekcji przechodzą do pojedynczej kolumny na mobile
// ---------------------------------------------------------------------------
test('18. Responsive Grids: główne siatki sekcji przechodzą do pojedynczej kolumny na mobile (grid-cols-1)', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /grid-cols-1\s+md:grid-cols-3/, 'Sekcja Jak to działa musi stosować grid-cols-1 na mobile i md:grid-cols-3 na desktopie');
  assert.match(code, /grid-cols-1\s+md:grid-cols-2/, 'Sekcja Korzyści musi stosować grid-cols-1 na mobile i md:grid-cols-2 na desktopie');
});

// ---------------------------------------------------------------------------
// 19. Responsive Hero Typography: nagłówek hero skaluje się responsywnie
// ---------------------------------------------------------------------------
test('19. Responsive Hero Typography: nagłówek hero skaluje się responsywnie i zachowuje czytelność', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /text-3xl\s+sm:text-5xl\s+md:text-6xl/, 'Nagłówek h1 w hero musi skalować się od text-3xl na telefonach do md:text-6xl');
  assert.match(code, /break-words/, 'Nagłówek h1 musi posiadać zabezpieczenie break-words');
});

// ---------------------------------------------------------------------------
// 20. Mobile-Safe Touch Targets: min-h-[44px]
// ---------------------------------------------------------------------------
test('20. Mobile-Safe Touch Targets: główne przyciski CTA posiadają rozmiar dotykowy minimum 44px', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  const matches = code.match(/min-h-\[44px\]/g);
  assert.ok(matches && matches.length >= 4, 'Landing page musi zawierać min-h-[44px] na kluczowych elementach interaktywnych');
});

// ---------------------------------------------------------------------------
// 21. Mobile-Safe Header: pasek nawigacji ukrywa linki środkowe na mobile
// ---------------------------------------------------------------------------
test('21. Mobile-Safe Header: pasek nawigacji ukrywa linki środkowe na mobile i chroni logo/CTA przed kolizją', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.match(code, /<nav\s+className=["']hidden\s+md:flex/, 'Pasek nawigacji musi mieć ukryte linki na telefonach (hidden md:flex)');
});

// ---------------------------------------------------------------------------
// 22. No Horizontal Overflow Classes: brak sztywnych szerokości w px wymuszających overflow
// ---------------------------------------------------------------------------
test('22. No Horizontal Overflow Classes: brak sztywnych szerokości w px wymuszających overflow na mobile', () => {
  const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
  const code = fs.readFileSync(pagePath, 'utf8');

  assert.doesNotMatch(code, /\bw-\[\d{3,}px\](?!\s+h-)/, 'Nie mogą występować sztywne w-[...px] bez ograniczeń responsywnych');
  assert.match(code, /max-w-\[550px\]/, 'Ambient glow w hero musi mieć ograniczenie max-w-[550px] z w-full');
});

// ---------------------------------------------------------------------------
// 23. Mobile-Safe Legal Pages: responsywne paddingi i zawijanie tekstu
// ---------------------------------------------------------------------------
test('23. Mobile-Safe Legal Pages: podstrony prawne posiadają responsywne paddingi i bezpieczne zawijanie tekstu', () => {
  const privacyPath = path.resolve(process.cwd(), 'app/polityka-prywatnosci/page.tsx');
  const termsPath = path.resolve(process.cwd(), 'app/zasady-korzystania/page.tsx');
  const affiliatePath = path.resolve(process.cwd(), 'app/informacja-o-afiliacji/page.tsx');

  for (const p of [privacyPath, termsPath, affiliatePath]) {
    const code = fs.readFileSync(p, 'utf8');
    assert.match(code, /overflow-x-hidden/, `${p} musi posiadać overflow-x-hidden`);
    assert.match(code, /break-words/, `${p} musi posiadać break-words`);
    assert.match(code, /py-10\s+sm:py-16/, `${p} musi mieć zoptymalizowany padding wertykalny na mobile`);
  }
});
