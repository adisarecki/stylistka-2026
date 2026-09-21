export type ProductSourceType =
  | 'serper_inspiration'
  | 'affiliate_feed'
  | 'merchant_feed'
  | 'local_boutique';

export type ProductKind = 'inspiration' | 'commerce';

export type ProductAvailability = 'unknown' | 'in_stock' | 'out_of_stock';

export interface Money {
  amount: number;
  currency: string;
}

export interface ProductImage {
  url: string;
  role: 'hero' | 'try_on';
  source: 'merchant' | 'affiliate' | 'search_engine' | 'boutique';
  width: number | null;
  height: number | null;
}

export interface TryOnAsset {
  image: ProductImage;
  status: 'verified';
  verifiedBy: 'merchant_feed' | 'manual' | 'classifier';
  verifiedAt: string;
}

export interface MerchantSummary {
  id: string | null;
  name: string;
  domain: string | null;
}

export interface CanonicalProduct {
  id: string;
  kind: ProductKind;
  sourceType: ProductSourceType;
  title: string;
  brand: string | null;
  merchant: MerchantSummary;
  productUrl: string;
  heroImage: ProductImage;
  tryOnAsset: TryOnAsset | null;
  price: Money | null;
  availability: ProductAvailability;
  availableSizes: string[];
  deliveryCountries: string[];
  marketCountry: string | null;
  affiliate: boolean;
  updatedAt: string | null;
}

/**
 * Type guard weryfikujący, czy produkt posiada bezpieczny i zweryfikowany zasób VTON.
 * Zwraca true wyłącznie gdy:
 * - tryOnAsset !== null
 * - status === 'verified'
 * - image.role === 'try_on'
 * - URL obrazu posiada poprawny protokół HTTP lub HTTPS
 */
export function hasVerifiedTryOnAsset(
  product: CanonicalProduct | null | undefined
): product is CanonicalProduct & { tryOnAsset: TryOnAsset } {
  if (!product || !product.tryOnAsset) {
    return false;
  }

  const { status, image } = product.tryOnAsset;
  if (status !== 'verified' || !image || image.role !== 'try_on') {
    return false;
  }

  if (typeof image.url !== 'string' || !image.url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(image.url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Type guard sprawdzający, czy produkt jest rzeczywistym produktem handlowym (commerce).
 */
export function isCommerceProduct(
  product: CanonicalProduct | null | undefined
): boolean {
  return product?.kind === 'commerce';
}
