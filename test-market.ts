import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_MARKET_CODE,
  ACTIVE_MARKETS,
  POLAND_MARKET_PROFILE,
  getMarketProfile,
  isSupportedMarketCode,
  getMarketSearchDomains,
  parseMarketCode,
  buildMarketSiteFilter,
} from './lib/market-config';

// ---------------------------------------------------------------------------
// 1. TESTY JEDNOSTKOWE KONFIGURACJI RYNKU
// ---------------------------------------------------------------------------
test('Market Config: DEFAULT_MARKET_CODE to "PL"', () => {
  assert.equal(DEFAULT_MARKET_CODE, 'PL');
});

test('Market Config: ACTIVE_MARKETS zawiera dokładnie jeden aktywny rynek', () => {
  assert.equal(ACTIVE_MARKETS.length, 1);
  assert.equal(ACTIVE_MARKETS[0].marketCode, 'PL');
});

test('Market Config: Profil rynku PL posiada poprawne dane regionalne i Serper', () => {
  assert.deepEqual(POLAND_MARKET_PROFILE, {
    marketCode: 'PL',
    deliveryCountry: 'PL',
    countryName: 'Polska',
    currency: 'PLN',
    language: 'pl',
    locale: 'pl-PL',
    serperGl: 'pl',
    serperHl: 'pl',
  });
  assert.equal(getMarketProfile('PL'), POLAND_MARKET_PROFILE);
});

test('Market Config: isSupportedMarketCode jest strict (tylko "PL")', () => {
  assert.equal(isSupportedMarketCode('PL'), true);
  assert.equal(isSupportedMarketCode('pl'), false);
  assert.equal(isSupportedMarketCode('DE'), false);
  assert.equal(isSupportedMarketCode('GB'), false);
  assert.equal(isSupportedMarketCode('US'), false);
  assert.equal(isSupportedMarketCode(''), false);
  assert.equal(isSupportedMarketCode(null), false);
  assert.equal(isSupportedMarketCode(undefined), false);
});

test('Market Config: parseMarketCode normalizuje bezpiecznie wejście', () => {
  assert.equal(parseMarketCode('PL'), 'PL');
  assert.equal(parseMarketCode(' pl '), 'PL');
  assert.equal(parseMarketCode('pL'), 'PL');
  assert.equal(parseMarketCode('DE'), null);
  assert.equal(parseMarketCode(''), null);
  assert.equal(parseMarketCode(null), null);
  assert.equal(parseMarketCode(undefined), null);
});

test('Market Config: getMarketSearchDomains zwraca dokładnie 4 domeny dla PL i [] dla innych', () => {
  const plDomains = getMarketSearchDomains('PL');
  assert.deepEqual(plDomains, ['zalando.pl', 'modivo.pl', 'answear.com', 'hm.com']);

  // Format domen: brak schematu, brak ukośników, brak spacji
  for (const domain of plDomains) {
    assert.doesNotMatch(domain, /^https?:\/\//);
    assert.doesNotMatch(domain, /\//);
    assert.doesNotMatch(domain, /\s/);
    assert.match(domain, /^[a-z0-9.-]+\.[a-z]{2,}$/);
  }

  assert.deepEqual(getMarketSearchDomains('DE'), []);
  assert.deepEqual(getMarketSearchDomains('US'), []);
  assert.deepEqual(getMarketSearchDomains(null), []);
});

test('Market Config: getMarketProfile zwraca null dla nieobsługiwanych rynków (brak nieuprawnionego fallbacku)', () => {
  assert.equal(getMarketProfile('DE'), null);
  assert.equal(getMarketProfile('GB'), null);
  assert.equal(getMarketProfile('US'), null);
  assert.equal(getMarketProfile('unknown'), null);
});

// ---------------------------------------------------------------------------
// 2. TESTY HELPERA buildMarketSiteFilter (KROK 4C-1)
// ---------------------------------------------------------------------------
test('buildMarketSiteFilter: poprawnie formatuje 4 domeny z nawiasami i operatorami OR', () => {
  const domains = ['zalando.pl', 'modivo.pl', 'answear.com', 'hm.com'];
  const filter = buildMarketSiteFilter(domains);

  assert.equal(filter, '(site:zalando.pl OR site:modivo.pl OR site:answear.com OR site:hm.com)');
  assert.ok(filter.startsWith('('));
  assert.ok(filter.endsWith(')'));

  // Dokładnie 3 operatory OR pomiędzy 4 domenami
  const orMatches = filter.match(/\sOR\s/g);
  assert.equal(orMatches?.length, 3);
});

test('buildMarketSiteFilter: odrzuca pustą listę domen', () => {
  assert.throws(() => buildMarketSiteFilter([]), /nie może być pusta/);
  // @ts-expect-error testowanie niepoprawnego wejścia runtime
  assert.throws(() => buildMarketSiteFilter(null), /nie może być pusta/);
});

test('buildMarketSiteFilter: odrzuca nieprawidłowe formaty hostów i próby wstrzyknięć', () => {
  assert.throws(() => buildMarketSiteFilter(['https://example.com']), /Nieprawidłowy format domeny/);
  assert.throws(() => buildMarketSiteFilter(['example.com/path']), /Nieprawidłowy format domeny/);
  assert.throws(() => buildMarketSiteFilter(['example.com OR site:evil.com']), /Nieprawidłowy format domeny/);
  assert.throws(() => buildMarketSiteFilter(['example .com']), /Nieprawidłowy format domeny/);
  assert.throws(() => buildMarketSiteFilter(['']), /Nieprawidłowy element|Nieprawidłowy format/);
});

// ---------------------------------------------------------------------------
// 3. STATYCZNE TESTY INTEGRACJI I ARCHITEKTURY
// ---------------------------------------------------------------------------
test('Static Check: brak wywołań zewnętrznej geolokalizacji w całym kodzie aplikacji', () => {
  const searchDirs = ['app', 'components', 'lib', 'types'];
  const forbiddenPatterns = [
    'bigdatacloud',
    'geojs.io',
    'navigator.geolocation',
    'getCurrentPosition',
    'Będzin / Śląsk',
    '(GPS)',
    '(wg IP)',
  ];

  for (const dir of searchDirs) {
    const fullDir = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(fullDir)) continue;

    const walk = (d: string): string[] => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      let files: string[] = [];
      for (const e of entries) {
        const res = path.join(d, e.name);
        if (e.isDirectory()) files = files.concat(walk(res));
        else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) files.push(res);
      }
      return files;
    };

    const files = walk(fullDir);
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      for (const pat of forbiddenPatterns) {
        assert.equal(
          content.includes(pat),
          false,
          `Znaleziono zabronioną frazę geolokalizacyjną "${pat}" w pliku ${f}`
        );
      }
    }
  }
});

test('Static Check: app/api/products/route.ts wymusza buildMarketSiteFilter dla wszystkich prób Serper', () => {
  const routePath = path.resolve(process.cwd(), 'app/api/products/route.ts');
  const code = fs.readFileSync(routePath, 'utf8');

  // Domeny nie mogą występować jako literały w route.ts
  assert.doesNotMatch(code, /site:zalando\.pl/);
  assert.doesNotMatch(code, /site:modivo\.pl/);
  assert.doesNotMatch(code, /site:answear\.com/);
  assert.doesNotMatch(code, /site:hm\.com/);

  // Musi używać buildMarketSiteFilter oraz getMarketSearchDomains
  assert.match(code, /buildMarketSiteFilter/);
  assert.match(code, /getMarketSearchDomains/);
  assert.match(code, /getMarketProfile/);
  assert.match(code, /isSupportedMarketCode/);
  assert.match(code, /UNSUPPORTED_MARKET/);

  // callSerper musi bezwzględnie doklejać siteFilter do każdego zapytania
  assert.match(
    code,
    /const\s+finalQuery\s*=\s*`\$\{searchQuery\}\s+\$\{siteFilter\}`/,
    'Funkcja callSerper musi wymuszać siteFilter w każdym zapytaniu'
  );

  // Brak globalnego fallbacku wyszukującego poza domenami rynku
  assert.doesNotMatch(
    code,
    /callSerper\(.*false\)/,
    'Zabronione wywołanie callSerper bez modyfikatora filtra domen'
  );

  // Musi przekazywać parametry regionalne gl i hl
  assert.match(code, /gl:\s*marketProfile\.serperGl/);
  assert.match(code, /hl:\s*marketProfile\.serperHl/);
});

test('Static Check: ShoppingCarousel używa useMarket i przesyła market w zapytaniu', () => {
  const carouselPath = path.resolve(process.cwd(), 'components/ShoppingCarousel.tsx');
  const code = fs.readFileSync(carouselPath, 'utf8');

  assert.match(code, /useMarket/);
  assert.match(code, /&market=\$\{encodeURIComponent\(market\.marketCode\)\}/);
});

test('Static Check: stary kod LocationContext i LocationHeader został całkowicie usunięty', () => {
  const locCtx = path.resolve(process.cwd(), 'components/LocationContext.tsx');
  const locHdr = path.resolve(process.cwd(), 'components/LocationHeader.tsx');
  assert.equal(fs.existsSync(locCtx), false, 'LocationContext.tsx nie może istnieć');
  assert.equal(fs.existsSync(locHdr), false, 'LocationHeader.tsx nie może istnieć');
});
