import { MarketCode, MarketProfile } from '@/types/market';

export const DEFAULT_MARKET_CODE: MarketCode = 'PL';

export const POLAND_MARKET_PROFILE: Readonly<MarketProfile> = Object.freeze({
  marketCode: 'PL',
  deliveryCountry: 'PL',
  countryName: 'Polska',
  currency: 'PLN',
  language: 'pl',
  locale: 'pl-PL',
  serperGl: 'pl',
  serperHl: 'pl',
});

/**
 * Jedno źródło prawdy dla aktywnych rynków w systemie.
 * Obecnie wspierany jest wyłącznie rynek polski.
 */
export const ACTIVE_MARKETS: readonly Readonly<MarketProfile>[] = Object.freeze([
  POLAND_MARKET_PROFILE,
]);

/**
 * Domeny używane wyłącznie do zapytań inspiracyjnych w wyszukiwarce.
 * Nie oznaczają partnerstwa handlowego, feedu ani weryfikacji.
 */
const POLAND_INSPIRATION_SEARCH_DOMAINS: readonly string[] = Object.freeze([
  'zalando.pl',
  'modivo.pl',
  'answear.com',
  'hm.com',
]);

/**
 * Type guard weryfikujący czy podana wartość jest ściśle wspieranym kodem rynku ("PL").
 */
export function isSupportedMarketCode(value: unknown): value is MarketCode {
  return value === 'PL';
}

/**
 * Zwraca profil rynku dla danego kodu.
 * Zwraca profil wyłącznie gdy kod jest poprawnym, obsługiwanym rynkiem. W przeciwnym razie null.
 */
export function getMarketProfile(code: unknown): Readonly<MarketProfile> | null {
  if (code === 'PL') {
    return POLAND_MARKET_PROFILE;
  }
  return null;
}

/**
 * Zwraca domeny wyszukiwania inspiracyjnego dla danego rynku.
 * Zwraca pustą tablicę dla nieobsługiwanych rynków.
 */
export function getMarketSearchDomains(code: unknown): readonly string[] {
  if (code === 'PL') {
    return POLAND_INSPIRATION_SEARCH_DOMAINS;
  }
  return Object.freeze([]);
}

/**
 * Bezpiecznie normalizuje surowy parametr wejściowy (np. z query params API lub localStorage).
 * Zwraca "PL" gdy wejście po trim/uppercase to "PL", w przeciwnym razie null.
 */
export function parseMarketCode(raw: unknown): MarketCode | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = raw.trim().toUpperCase();
  if (isSupportedMarketCode(normalized)) {
    return normalized;
  }
  return null;
}

/**
 * Wzorzec bezpiecznej nazwy hosta/domeny (brak protokołu, brak ścieżki, brak spacji, brak operatorów query).
 */
const HOSTNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Buduje bezpieczny filtr domen wyszukiwarki: (site:domain1 OR site:domain2 OR ...)
 * Zwraca błąd jeśli lista domen jest pusta lub zawiera nieprawidłowy format hosta.
 */
export function buildMarketSiteFilter(domains: readonly string[]): string {
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    throw new Error('Lista domen dla filtru rynkowego nie może być pusta.');
  }

  for (const domain of domains) {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Nieprawidłowy element na liście domen.');
    }
    const trimmed = domain.trim();
    if (!HOSTNAME_REGEX.test(trimmed)) {
      throw new Error(`Nieprawidłowy format domeny rynku: "${domain}". Wymagany format hostname (np. example.com).`);
    }
  }

  const parts = domains.map(d => `site:${d.trim()}`);
  return `(${parts.join(' OR ')})`;
}
