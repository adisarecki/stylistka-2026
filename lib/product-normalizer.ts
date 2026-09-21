import { CanonicalProduct } from '@/types/product';

export interface SerperRawImageItem {
  title?: string;
  link?: string;
  imageUrl?: string;
  source?: string;
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * Bezpiecznie sprawdza czy string jest poprawnym URLem HTTP lub HTTPS.
 */
function isValidHttpUrl(urlString: string | undefined | null): boolean {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Ekstrahuje domenę oraz przyjazną nazwę sklepu z poprawnego adresu URL.
 */
function extractDomainAndName(urlString: string, fallbackSource?: string): { domain: string | null; name: string } {
  try {
    const parsed = new URL(urlString);
    const domain = parsed.hostname.toLowerCase();
    const cleanName = domain.replace(/^www\./, '');
    return {
      domain,
      name: cleanName || fallbackSource || 'Sklep internetowy',
    };
  } catch {
    return {
      domain: null,
      name: fallbackSource || 'Sklep internetowy',
    };
  }
}

/**
 * Normalizuje surowe wyniki wyszukiwarki Serper Images do modelu CanonicalProduct jako inspirację ("serper_inspiration").
 *
 * Zasady:
 * - Odrzuca elementy bez prawidłowego URL strony produktu lub prawidłowego URL obrazu.
 * - kind: "inspiration"
 * - sourceType: "serper_inspiration"
 * - tryOnAsset: null (brak domyślnej weryfikacji dla surowych obrazów z wyszukiwarki)
 * - price, brand, marketCountry, updatedAt: null
 * - availability: "unknown"
 * - availableSizes, deliveryCountries: []
 * - affiliate: false
 */
export function normalizeSerperImages(
  rawImages: SerperRawImageItem[] | undefined | null,
  maxResults = 20
): CanonicalProduct[] {
  if (!Array.isArray(rawImages)) {
    return [];
  }

  const products: CanonicalProduct[] = [];

  for (let i = 0; i < rawImages.length && products.length < maxResults; i++) {
    const item = rawImages[i];
    if (!item) continue;

    const { link, imageUrl, title, source, imageWidth, imageHeight } = item;

    // Walidacja URLi - wymagany poprawny protokół HTTP/HTTPS
    if (!isValidHttpUrl(link) || !isValidHttpUrl(imageUrl)) {
      continue;
    }

    const { domain, name } = extractDomainAndName(link!, source);

    const width = typeof imageWidth === 'number' && Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : null;
    const height = typeof imageHeight === 'number' && Number.isFinite(imageHeight) && imageHeight > 0 ? imageHeight : null;

    products.push({
      id: `serper-insp-${i}`,
      kind: 'inspiration',
      sourceType: 'serper_inspiration',
      title: (title && typeof title === 'string' && title.trim()) ? title.trim() : 'Inspiracja modowa',
      brand: null,
      merchant: {
        id: null,
        name,
        domain,
      },
      productUrl: link!,
      heroImage: {
        url: imageUrl!,
        role: 'hero',
        source: 'search_engine',
        width,
        height,
      },
      tryOnAsset: null,
      price: null,
      availability: 'unknown',
      availableSizes: [],
      deliveryCountries: [],
      marketCountry: null,
      affiliate: false,
      updatedAt: null,
    });
  }

  return products;
}
