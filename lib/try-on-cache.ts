import crypto from 'node:crypto';

export interface CacheFingerprintParams {
  verifiedUid: string;
  userImageSha256: string;
  clothingIdentifierOrSha256: string;
  category: string;
  replicatePrompt: string;
  modelIdentifier: string;
  guidanceScale: number;
  numInferenceSteps: number;
  seed: number;
}

/**
 * Oblicza deterministyczny fingerprint cache SHA-256 dla zadania VTON.
 * Każda zmiana zdjęcia użytkownika, ubrania, promptu, kategorii czy parametrów modelu
 * generuje unikalny klucz cache, przypisany ściśle do verifiedUid.
 */
export function computeTryOnCacheKey(params: CacheFingerprintParams): string {
  const normalized = [
    params.verifiedUid,
    params.userImageSha256,
    params.clothingIdentifierOrSha256,
    params.category.toLowerCase().trim(),
    params.replicatePrompt.trim(),
    params.modelIdentifier,
    params.guidanceScale.toString(),
    params.numInferenceSteps.toString(),
    params.seed.toString(),
  ].join('|');

  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}
