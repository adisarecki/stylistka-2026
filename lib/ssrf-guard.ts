import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import { validateImageBuffer, formatToMime, type SupportedImageFormat } from './image-validator';

export interface SafeFetchImageOptions {
  maxSizeBytes?: number; // domyślnie 10MB
  timeoutMs?: number;    // domyślnie 10s
  maxRedirects?: number; // domyślnie 3
}

export interface SafeImageResult {
  buffer: Buffer;
  contentType: string;
  format: SupportedImageFormat;
  extension: string;
}

export class SsrffValidationError extends Error {
  readonly code = 'SSRF_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'SsrffValidationError';
    Object.setPrototypeOf(this, SsrffValidationError.prototype);
  }
}

/**
 * Sprawdza, czy dany adres IPv4 jest prywatny, loopback, link-local, multicast lub nieokreślony.
 */
function isDisallowedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // niepoprawny IPv4 traktujemy jako zabroniony
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network / unspecified)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (a === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata np. 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (a === 192 && b === 168) return true;

  // 100.64.0.0/10 (Carrier-grade NAT RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0) return true;

  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (a >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (a === 255) return true;

  return false;
}

/**
 * Sprawdza, czy dany adres IPv6 jest prywatny, loopback, link-local, multicast lub IPv4-mapped.
 */
function isDisallowedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::, ::1 (Unspecified, Loopback)
  if (normalized === '::' || normalized === '::1') return true;

  // IPv4-mapped IPv6 np. ::ffff:127.0.0.1 lub ::ffff:169.254.169.254
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.substring(7);
    if (net.isIPv4(v4Part)) {
      return isDisallowedIPv4(v4Part);
    }
    return true;
  }

  // fe80::/10 (Link-local)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // fc00::/7, fd00::/8 (Unique local / Private)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // ff00::/8 (Multicast)
  if (normalized.startsWith('ff')) {
    return true;
  }

  return false;
}

/**
 * Waliduje pojedynczy adres IP.
 */
export function isPrivateOrDisallowedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    return isDisallowedIPv4(ip);
  }
  if (version === 6) {
    return isDisallowedIPv6(ip);
  }
  return true; // nieznany format IP -> odrzuć
}

/**
 * Weryfikuje strukturę URL pod kątem protokołu, credentials i lokalnych nazw hostów.
 */
export function validateUrlStructure(urlString: string): URL {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new SsrffValidationError('Nieprawidłowy format URL.');
  }

  // 1. Dozwolony wyłącznie protokół HTTPS
  if (parsedUrl.protocol !== 'https:') {
    throw new SsrffValidationError('Dozwolony jest wyłącznie protokół HTTPS.');
  }

  // 2. Odrzuć URL zawierający credentials (username/password)
  if (parsedUrl.username || parsedUrl.password) {
    throw new SsrffValidationError('URL nie może zawierać danych uwierzytelniających.');
  }

  // 3. Odrzuć localhost i nazwy lokalne/specjalne
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.lan') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata'
  ) {
    throw new SsrffValidationError('Niedozwolony docelowy host.');
  }

  return parsedUrl;
}

/**
 * Rozwiązuje hostname przez DNS, waliduje wszystkie zwrócone adresy IP
 * i zwraca bezpieczny przypięty adres IP (pinned IP).
 */
export async function resolveAndValidateHost(hostname: string): Promise<string> {
  // Jeśli hostname jest już adresem IP (literal)
  if (net.isIP(hostname)) {
    if (isPrivateOrDisallowedIp(hostname)) {
      throw new SsrffValidationError('Docelowy adres IP znajduje się w niedozwolonym zakresie sieci prywatnej/lokalnej.');
    }
    return hostname;
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new SsrffValidationError('Nie udało się rozwiązać nazwy domenowej.');
    }

    // Odrzuć host, jeśli CHOCIAŻ JEDEN z jego adresów IP jest prywatny / zabroniony
    for (const record of addresses) {
      if (isPrivateOrDisallowedIp(record.address)) {
        throw new SsrffValidationError(`Docelowy adres IP (${record.address}) należy do niedozwolonego zakresu sieci.`);
      }
    }

    // Wybierz pierwszy sprawdzony adres IP do przypięcia połączenia
    return addresses[0].address;
  } catch (err: unknown) {
    if (err instanceof SsrffValidationError) throw err;
    throw new SsrffValidationError('Błąd rozpoznawania adresu DNS.');
  }
}

/**
 * Wykonuje pojedyncze żądanie HTTPS z przypiętym zweryfikowanym adresem IP (Pinning),
 * zachowaniem nagłówka Host, SNI oraz pełną walidacją certyfikatu TLS.
 */
function fetchHttpsWithPinnedIp(
  parsedUrl: URL,
  pinnedIp: string,
  timeoutMs: number,
  maxSizeBytes: number
): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443;
    const ipFamily = net.isIP(pinnedIp);

    const reqOptions: https.RequestOptions = {
      host: parsedUrl.hostname, // Używane do nagłówka Host i certyfikatu
      port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Stylistka2026-ImageProxy/1.0',
        'Accept': 'image/jpeg,image/png,image/webp,image/avif',
      },
      servername: parsedUrl.hostname, // Wymuszenie SNI dla oryginalnego hostname
      rejectUnauthorized: true,       // Pełna weryfikacja certyfikatu TLS (NIE WYŁĄCZAĆ!)
      timeout: timeoutMs,
      // Kluczowe rozwiązanie DNS Rebinding: custom lookup kieruje socket bezpośrednio do pinnedIp!
      lookup: (_hostname, _options, callback) => {
        callback(null, pinnedIp, ipFamily === 6 ? 6 : 4);
      },
    };

    const req = https.request(reqOptions, (res) => {
      const statusCode = res.statusCode || 500;
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxSizeBytes) {
          req.destroy(new SsrffValidationError(`Obraz przekracza maksymalny dopuszczalny rozmiar (${Math.round(maxSizeBytes / 1024 / 1024)}MB).`));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new SsrffValidationError('Przekroczono limit czasu oczekiwania na pobranie obrazu.'));
    });

    req.on('error', (err) => {
      if (err instanceof SsrffValidationError) {
        reject(err);
      } else {
        reject(new SsrffValidationError(`Błąd sieci TLS/HTTPS: ${err.message}`));
      }
    });

    req.end();
  });
}

/**
 * Bezpiecznie pobiera zewnętrzny obraz z pełną ochroną przed SSRF, DNS rebinding (IP pinning),
 * weryfikacją każdego przekierowania, limitem rozmiaru, timeoutem i walidacją magic bytes.
 */
export async function safeFetchExternalImage(
  targetUrl: string,
  options: SafeFetchImageOptions = {}
): Promise<SafeImageResult> {
  const maxSizeBytes = options.maxSizeBytes ?? 10 * 1024 * 1024; // 10 MB
  const timeoutMs = options.timeoutMs ?? 10000;                  // 10s
  const maxRedirects = options.maxRedirects ?? 3;

  let currentUrl = targetUrl;
  let redirectsCount = 0;

  while (true) {
    // 1. Walidacja strukturalna URL (HTTPS, brak credentials, brak lokalnych hostów)
    const parsed = validateUrlStructure(currentUrl);

    // 2. Rozwiązanie DNS i walidacja wszystkich IP -> wybór pinned IP
    const pinnedIp = await resolveAndValidateHost(parsed.hostname);

    // 3. Połączenie HTTPS z przypiętym IP, SNI i timeoutem
    const response = await fetchHttpsWithPinnedIp(parsed, pinnedIp, timeoutMs, maxSizeBytes);

    // 4. Obsługa przekierowań (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new SsrffValidationError('Przekroczono maksymalną dozwoloną liczbę przekierowań.');
      }

      const locationHeader = response.headers['location'];
      const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
      if (!location) {
        throw new SsrffValidationError('Brak nagłówka Location w odpowiedzi przekierowania.');
      }

      try {
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = nextUrl;
      } catch {
        throw new SsrffValidationError('Nieprawidłowy URL w przekierowaniu.');
      }

      continue; // kolejny skok redirectu przechodzi cały proces od nowa
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new SsrffValidationError(`Serwer źródłowy obrazu zwrócił błąd HTTP ${response.statusCode}.`);
    }

    // 5. Walidacja Magic Bytes z bufora binarnego
    const rawContentType = response.headers['content-type'];
    const declaredMime = (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType) || undefined;

    const validation = validateImageBuffer(response.body, maxSizeBytes, declaredMime);
    if (!validation.valid || !validation.format || !validation.extension) {
      throw new SsrffValidationError(validation.error || 'Nieobsługiwany lub uszkodzony plik obrazu.');
    }

    return {
      buffer: response.body,
      contentType: formatToMime(validation.format),
      format: validation.format,
      extension: validation.extension,
    };
  }
}
