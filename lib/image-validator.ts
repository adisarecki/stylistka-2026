export type SupportedImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';

export interface ImageTypeValidationResult {
  valid: boolean;
  format?: SupportedImageFormat;
  mimeType?: string;
  extension?: string;
  error?: string;
}

/**
 * Rozpoznaje format obrazu na podstawie rzeczywistej sygnatury binarnej (magic bytes).
 * Obsługuje: JPEG, PNG, WebP, AVIF (ISO BMFF).
 *
 * @param buffer Bufor danych pliku
 * @returns Wykryty format lub null jeśli bufor nie pasuje do dozwolonych formatów
 */
export function detectImageFormat(buffer: Buffer): SupportedImageFormat | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // 3. WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  // 4. AVIF: ISO Base Media File Format (ISOBMFF)
  // Bytes 4-7 to 'ftyp' (0x66 0x74 0x79 0x70)
  // Major brand (bytes 8-11) lub compatible brands zawierają 'avif' lub 'avis'
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    // Odczytaj rozmiar boxa ftyp (pierwsze 4 bajty jako big-endian uint32)
    const ftypBoxLength = buffer.readUInt32BE(0);
    const searchLimit = Math.min(buffer.length, Math.max(ftypBoxLength, 32));

    // Sprawdź 4-bajtowe chunki od bajtu 8 do searchLimit pod kątem 'avif' lub 'avis'
    for (let offset = 8; offset + 4 <= searchLimit; offset += 4) {
      const brand = buffer.toString('ascii', offset, offset + 4);
      if (brand === 'avif' || brand === 'avis') {
        return 'avif';
      }
    }
  }

  return null;
}

/**
 * Mapuje format na standardowy typ MIME.
 */
export function formatToMime(format: SupportedImageFormat): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
  }
}

/**
 * Mapuje format na bezpieczne rozszerzenie pliku.
 */
export function formatToExtension(format: SupportedImageFormat): string {
  switch (format) {
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
    case 'avif':
      return 'avif';
  }
}

/**
 * Weryfikuje bufor obrazu pod kątem rozmiaru oraz rzeczywistej sygnatury magic bytes.
 */
export function validateImageBuffer(
  buffer: Buffer,
  maxSizeBytes = 10 * 1024 * 1024,
  expectedMime?: string
): ImageTypeValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Bufor obrazu jest pusty.' };
  }

  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `Rozmiar obrazu (${Math.round(buffer.length / 1024 / 1024 * 10) / 10}MB) przekracza dopuszczalny limit ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`
    };
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    return {
      valid: false,
      error: 'Nieobsługiwany format lub uszkodzona sygnatura pliku obrazu. Dozwolone: JPEG, PNG, WebP, AVIF.'
    };
  }

  const detectedMime = formatToMime(detected);
  const detectedExt = formatToExtension(detected);

  // Jeśli podano deklarowany MIME, zweryfikuj czy nie ma rażącej sprzeczności
  if (expectedMime) {
    const normalizedExpected = expectedMime.split(';')[0].trim().toLowerCase();
    // Akceptujemy image/jpeg oraz image/jpg jako tożsame
    const isJpegMatch = (normalizedExpected === 'image/jpeg' || normalizedExpected === 'image/jpg') && detected === 'jpeg';
    if (normalizedExpected !== detectedMime && !isJpegMatch) {
      return {
        valid: false,
        format: detected,
        mimeType: detectedMime,
        extension: detectedExt,
        error: `Deklarowany typ (${normalizedExpected}) nie zgadza się z rzeczywistą sygnaturą binarną (${detectedMime}).`
      };
    }
  }

  return {
    valid: true,
    format: detected,
    mimeType: detectedMime,
    extension: detectedExt
  };
}
