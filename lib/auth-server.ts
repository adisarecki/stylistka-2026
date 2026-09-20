import 'server-only';
import { getAdminAuth, FirebaseAdminConfigurationError } from './firebase-admin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

type AuthSuccess = {
  ok: true;
  user: AuthenticatedUser;
};

type AuthFailure = {
  ok: false;
  status: 401 | 500;
  code: 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'SERVER_CONFIG_ERROR';
  message: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type HeaderParseResult =
  | { ok: true; token: string }
  | { ok: false; code: 'AUTH_REQUIRED' | 'AUTH_INVALID'; message: string };

export function parseAuthorizationHeader(header: string | null | undefined): HeaderParseResult {
  if (!header || header.trim() === '') {
    return {
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Wymagana autoryzacja. Brak nagłówka Authorization.',
    };
  }

  // Bezwzględne odrzucenie znaków kontrolnych CR/LF (ochrona przed Header Injection / Smuggling)
  if (header.includes('\r') || header.includes('\n')) {
    return {
      ok: false,
      code: 'AUTH_INVALID',
      message: 'Nieprawidłowy format nagłówka Authorization. Wykryto niedozwolone znaki kontrolne.',
    };
  }

  const trimmed = header.trim();

  // Odrzuć wielokrotne wartości rozdzielone przecinkiem
  if (trimmed.includes(',')) {
    return {
      ok: false,
      code: 'AUTH_INVALID',
      message: 'Nieprawidłowy format nagłówka Authorization. Oczekiwano pojedynczego tokenu Bearer.',
    };
  }

  // Rozdziel na segmenty białymi znakami (spacje lub tabulatory)
  const parts = trimmed.split(/[ \t]+/);
  if (parts.length !== 2) {
    return {
      ok: false,
      code: 'AUTH_INVALID',
      message: 'Nieprawidłowy format nagłówka Authorization. Oczekiwano formatu: Bearer <token>.',
    };
  }

  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer') {
    return {
      ok: false,
      code: 'AUTH_INVALID',
      message: 'Nieprawidłowy schemat autoryzacji. Oczekiwano Bearer.',
    };
  }

  if (!token || token.trim() === '') {
    return {
      ok: false,
      code: 'AUTH_INVALID',
      message: 'Token autoryzacyjny nie może być pusty.',
    };
  }

  return {
    ok: true,
    token,
  };
}

export async function requireAuthenticatedUser(
  request: Request
): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  const parseResult = parseAuthorizationHeader(authHeader);

  if (!parseResult.ok) {
    return {
      ok: false,
      status: 401,
      code: parseResult.code,
      message: parseResult.message,
    };
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(parseResult.token);

    if (!decoded.uid || typeof decoded.uid !== 'string' || decoded.uid.trim() === '') {
      return {
        ok: false,
        status: 401,
        code: 'AUTH_INVALID',
        message: 'Nieprawidłowy token: brak identyfikatora użytkownika.',
      };
    }

    const user: AuthenticatedUser = {
      uid: decoded.uid,
      ...(typeof decoded.email === 'string' && decoded.email ? { email: decoded.email } : {}),
    };

    return {
      ok: true,
      user,
    };
  } catch (err: unknown) {
    if (err instanceof FirebaseAdminConfigurationError) {
      return {
        ok: false,
        status: 500,
        code: 'SERVER_CONFIG_ERROR',
        message: 'Błąd konfiguracji serwera autoryzacji.',
      };
    }

    const errCode =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as Record<string, unknown>).code)
        : '';

    if (
      errCode.startsWith('app/') ||
      errCode === 'auth/internal-error' ||
      errCode === 'auth/project-not-found'
    ) {
      return {
        ok: false,
        status: 500,
        code: 'SERVER_CONFIG_ERROR',
        message: 'Błąd usługi autoryzacji serwera.',
      };
    }

    return {
      ok: false,
      status: 401,
      code: 'AUTH_INVALID',
      message: 'Przekazany token autoryzacyjny jest nieprawidłowy lub wygasł.',
    };
  }
}
