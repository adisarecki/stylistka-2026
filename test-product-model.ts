import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CanonicalProduct,
  hasVerifiedTryOnAsset,
  isCommerceProduct,
} from './types/product';
import { normalizeSerperImages, SerperRawImageItem } from './lib/product-normalizer';

// ---------------------------------------------------------------------------
// 1. TESTY TYPE GUARD: hasVerifiedTryOnAsset
// ---------------------------------------------------------------------------
test('hasVerifiedTryOnAsset: zwraca false gdy tryOnAsset === null', () => {
  const product: CanonicalProduct = {
    id: 'prod-1',
    kind: 'inspiration',
    sourceType: 'serper_inspiration',
    title: 'Sukienka letnia',
    brand: null,
    merchant: { id: null, name: 'Zalando', domain: 'zalando.pl' },
    productUrl: 'https://zalando.pl/item-123',
    heroImage: {
      url: 'https://img01.ztat.net/article/1.jpg',
      role: 'hero',
      source: 'search_engine',
      width: 800,
      height: 1200,
    },
    tryOnAsset: null,
    price: null,
    availability: 'unknown',
    availableSizes: [],
    deliveryCountries: [],
    marketCountry: null,
    affiliate: false,
    updatedAt: null,
  };

  assert.equal(hasVerifiedTryOnAsset(product), false);
});

test('hasVerifiedTryOnAsset: zwraca true dla zweryfikowanego zasobu z poprawnym HTTPS URL i role="try_on"', () => {
  const product: CanonicalProduct = {
    id: 'prod-2',
    kind: 'commerce',
    sourceType: 'merchant_feed',
    title: 'Biała Koszula Bawełniana',
    brand: 'Elegance',
    merchant: { id: 'm-1', name: 'Zalando', domain: 'zalando.pl' },
    productUrl: 'https://zalando.pl/item-456',
    heroImage: {
      url: 'https://img01.ztat.net/article/hero.jpg',
      role: 'hero',
      source: 'merchant',
      width: 1000,
      height: 1500,
    },
    tryOnAsset: {
      image: {
        url: 'https://img01.ztat.net/article/packshot.jpg',
        role: 'try_on',
        source: 'merchant',
        width: 1000,
        height: 1500,
      },
      status: 'verified',
      verifiedBy: 'merchant_feed',
      verifiedAt: '2026-09-21T18:00:00Z',
    },
    price: { amount: 199.99, currency: 'PLN' },
    availability: 'in_stock',
    availableSizes: ['36', '38', '40'],
    deliveryCountries: ['PL'],
    marketCountry: 'PL',
    affiliate: false,
    updatedAt: '2026-09-21T18:00:00Z',
  };

  assert.equal(hasVerifiedTryOnAsset(product), true);
});

test('hasVerifiedTryOnAsset: zwraca false gdy role !== "try_on"', () => {
  const product: CanonicalProduct = {
    id: 'prod-3',
    kind: 'commerce',
    sourceType: 'merchant_feed',
    title: 'Kurtka jeansowa',
    brand: null,
    merchant: { id: null, name: 'H&M', domain: 'hm.com' },
    productUrl: 'https://hm.com/item-789',
    heroImage: {
      url: 'https://hm.com/hero.jpg',
      role: 'hero',
      source: 'merchant',
      width: null,
      height: null,
    },
    tryOnAsset: {
      image: {
        url: 'https://hm.com/hero.jpg',
        role: 'hero', // Błędna rola!
        source: 'merchant',
        width: null,
        height: null,
      },
      status: 'verified',
      verifiedBy: 'manual',
      verifiedAt: '2026-09-21T18:00:00Z',
    },
    price: null,
    availability: 'in_stock',
    availableSizes: [],
    deliveryCountries: [],
    marketCountry: null,
    affiliate: false,
    updatedAt: null,
  };

  assert.equal(hasVerifiedTryOnAsset(product), false);
});

test('hasVerifiedTryOnAsset: zwraca false dla niebezpiecznych schematów URL (javascript:, data:, file:)', () => {
  const makeWithUrl = (url: string): CanonicalProduct => ({
    id: 'prod-sec',
    kind: 'commerce',
    sourceType: 'merchant_feed',
    title: 'Test',
    brand: null,
    merchant: { id: null, name: 'Shop', domain: 'shop.com' },
    productUrl: 'https://shop.com/test',
    heroImage: {
      url: 'https://shop.com/hero.jpg',
      role: 'hero',
      source: 'merchant',
      width: null,
      height: null,
    },
    tryOnAsset: {
      image: {
        url,
        role: 'try_on',
        source: 'merchant',
        width: null,
        height: null,
      },
      status: 'verified',
      verifiedBy: 'manual',
      verifiedAt: '2026-09-21T18:00:00Z',
    },
    price: null,
    availability: 'in_stock',
    availableSizes: [],
    deliveryCountries: [],
    marketCountry: null,
    affiliate: false,
    updatedAt: null,
  });

  assert.equal(hasVerifiedTryOnAsset(makeWithUrl('javascript:alert(1)')), false);
  assert.equal(hasVerifiedTryOnAsset(makeWithUrl('data:image/png;base64,AAAA')), false);
  assert.equal(hasVerifiedTryOnAsset(makeWithUrl('file:///etc/passwd')), false);
  assert.equal(hasVerifiedTryOnAsset(makeWithUrl('')), false);
});

// ---------------------------------------------------------------------------
// 2. TESTY NORMALIZATORA SERPER IMAGES
// ---------------------------------------------------------------------------
test('normalizeSerperImages: mapuje surowe wyniki Serper na CanonicalProduct z kind="inspiration"', () => {
  const rawSerper = [
    {
      title: 'Piękna czarna sukienka koktajlowa',
      link: 'https://zalando.pl/dresses/black-123.html',
      imageUrl: 'https://img01.ztat.net/article/s123.jpg',
      source: 'zalando.pl',
      imageWidth: 600,
      imageHeight: 900,
    },
    {
      title: 'Klasyczna marynarka granatowa',
      link: 'https://modivo.pl/marynarka-456.html',
      imageUrl: 'https://img.modivo.pl/item.jpg',
      source: 'modivo.pl',
    },
  ];

  const normalized = normalizeSerperImages(rawSerper);
  assert.equal(normalized.length, 2);

  const item1 = normalized[0];
  assert.equal(item1.kind, 'inspiration');
  assert.equal(item1.sourceType, 'serper_inspiration');
  assert.equal(item1.brand, null);
  assert.equal(item1.tryOnAsset, null);
  assert.equal(item1.price, null);
  assert.equal(item1.availability, 'unknown');
  assert.deepEqual(item1.availableSizes, []);
  assert.deepEqual(item1.deliveryCountries, []);
  assert.equal(item1.marketCountry, null);
  assert.equal(item1.affiliate, false);
  assert.equal(item1.updatedAt, null);

  assert.equal(item1.merchant.name, 'zalando.pl');
  assert.equal(item1.merchant.domain, 'zalando.pl');
  assert.equal(item1.merchant.id, null);

  assert.equal(item1.heroImage.role, 'hero');
  assert.equal(item1.heroImage.source, 'search_engine');
  assert.equal(item1.heroImage.width, 600);
  assert.equal(item1.heroImage.height, 900);

  // Sprawdzenie item2 bez szerokości/wysokości
  const item2 = normalized[1];
  assert.equal(item2.heroImage.width, null);
  assert.equal(item2.heroImage.height, null);
  assert.equal(item2.tryOnAsset, null);
});

test('normalizeSerperImages: odrzuca elementy bez prawidłowego productUrl lub heroImage URL', () => {
  const invalidRaw = [
    {
      title: 'Brak linku',
      link: '',
      imageUrl: 'https://valid.com/img.jpg',
    },
    {
      title: 'Błędny protokół linku',
      link: 'javascript:void(0)',
      imageUrl: 'https://valid.com/img.jpg',
    },
    {
      title: 'Brak imageUrl',
      link: 'https://valid.com/item',
      imageUrl: '',
    },
    {
      title: 'Data URI imageUrl',
      link: 'https://valid.com/item',
      imageUrl: 'data:image/jpeg;base64,...',
    },
    {
      title: 'Poprawny element',
      link: 'https://valid.com/item',
      imageUrl: 'https://valid.com/img.jpg',
    },
  ];

  const res = normalizeSerperImages(invalidRaw);
  assert.equal(res.length, 1);
  assert.equal(res[0].title, 'Poprawny element');
});

test('normalizeSerperImages: sourceType="serper_inspiration" ma ZAWSZE tryOnAsset===null nawet przy nieoczekiwanych polach tryOn w wejściu', () => {
  const hostileRawItem: SerperRawImageItem & Record<string, unknown> = {
    title: 'Sukienka koktajlowa',
    link: 'https://zalando.pl/item-123',
    imageUrl: 'https://img01.ztat.net/article/1.jpg',
    // Nieoczekiwane pola wstrzyknięte do odpowiedzi
    tryOnAsset: {
      image: { url: 'https://attacker.com/vton.jpg', role: 'try_on' },
      status: 'verified',
    },
    tryOnUrl: 'https://attacker.com/vton.jpg',
    isVerified: true,
  };

  const [res] = normalizeSerperImages([hostileRawItem]);
  assert.ok(res);
  assert.equal(res.sourceType, 'serper_inspiration');
  assert.equal(res.kind, 'inspiration');
  assert.equal(res.tryOnAsset, null, 'Wynik Serper nie może nigdy otrzymać tryOnAsset');
  assert.equal(hasVerifiedTryOnAsset(res), false, 'Wynik Serper nie może przejść type guarda hasVerifiedTryOnAsset');
});

// ---------------------------------------------------------------------------
// 3. TESTY TYPE GUARD: isCommerceProduct
// ---------------------------------------------------------------------------
test('isCommerceProduct: zwraca false dla Serper inspiration i true dla commerce', () => {
  const inspirationProduct: CanonicalProduct = {
    id: 'insp-1',
    kind: 'inspiration',
    sourceType: 'serper_inspiration',
    title: 'Inspiracja',
    brand: null,
    merchant: { id: null, name: 'Web', domain: 'web.com' },
    productUrl: 'https://web.com',
    heroImage: { url: 'https://web.com/img.jpg', role: 'hero', source: 'search_engine', width: null, height: null },
    tryOnAsset: null,
    price: null,
    availability: 'unknown',
    availableSizes: [],
    deliveryCountries: [],
    marketCountry: null,
    affiliate: false,
    updatedAt: null,
  };

  const commerceProduct: CanonicalProduct = {
    ...inspirationProduct,
    id: 'comm-1',
    kind: 'commerce',
    sourceType: 'merchant_feed',
  };

  assert.equal(isCommerceProduct(inspirationProduct), false);
  assert.equal(isCommerceProduct(commerceProduct), true);
  assert.equal(isCommerceProduct(null), false);
  assert.equal(isCommerceProduct(undefined), false);
});

// ---------------------------------------------------------------------------
// 4. STATYCZNA WERYFIKACJA KONTRAKTU KOMPONENTU ShoppingCarousel (BRAK FALLBACKU VTON)
// ---------------------------------------------------------------------------
test('ShoppingCarousel Contract: przekazuje do VTON wyłącznie product.tryOnAsset.image.url bez jakiegokolwiek fallbacku do heroImage', () => {
  const componentPath = path.resolve(process.cwd(), 'components/ShoppingCarousel.tsx');
  const code = fs.readFileSync(componentPath, 'utf8');

  // 1. Sprawdź, czy wywołanie handlera przekazuje dokładnie product.tryOnAsset.image.url
  assert.match(
    code,
    /onSelectProduct\(\s*product\.tryOnAsset\.image\.url\s*,\s*product\.title\s*\)/,
    'Komponent musi przekazywać wyłącznie product.tryOnAsset.image.url do onSelectProduct'
  );

  // 2. Sprawdź czy przycisk VTON jest logicznie chroniony przez hasVerifiedTryOnAsset(product)
  assert.match(
    code,
    /const\s+canTryOn\s*=\s*hasVerifiedTryOnAsset\(product\)/,
    'Komponent musi wyliczać canTryOn przez hasVerifiedTryOnAsset(product)'
  );
  assert.match(
    code,
    /\{canTryOn\s*&&\s*\(/,
    'Renderowanie przycisku przymiarki musi być chronione przez {canTryOn && (...)}'
  );

  // 3. Twardy zakaz jakichkolwiek konstrukcji fallbacku do heroImage lub starego imageUrl
  const forbiddenPatterns = [
    /tryOnAsset\?\.image\.url\s*\|\|\s*product\.heroImage\.url/,
    /tryOnAsset\?\.image\.url\s*\?\?\s*product\.heroImage\.url/,
    /tryOnAsset\.image\.url\s*\|\|\s*product\.heroImage\.url/,
    /tryOnAsset\.image\.url\s*\?\?\s*product\.heroImage\.url/,
    /onSelectProduct\(\s*product\.heroImage\.url/,
    /onSelectProduct\(\s*product\.imageUrl/,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(
      code,
      pattern,
      `Wykryto zabroniony wzorzec fallbacku do heroImage/imageUrl: ${pattern.toString()}`
    );
  }
});
