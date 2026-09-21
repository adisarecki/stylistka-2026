export type MarketCode = 'PL';

export type MarketStatus = 'active' | 'coming_soon';

export interface MarketProfile {
  marketCode: MarketCode;
  deliveryCountry: MarketCode;
  countryName: string;
  currency: string;
  language: string;
  locale: string;
  serperGl: string;
  serperHl: string;
}
