'use client';

import { auth } from '@/lib/firebase';

export class AuthenticationRequiredError extends Error {
  readonly code = 'AUTH_REQUIRED';

  constructor(message = 'Użytkownik nie jest zalogowany.') {
    super(message);
    this.name = 'AuthenticationRequiredError';
    Object.setPrototypeOf(this, AuthenticationRequiredError.prototype);
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new AuthenticationRequiredError('Użytkownik nie jest zalogowany.');
  }

  // Pobierz świeży token (automatycznie odświeżany przez Firebase Client SDK)
  const token = await currentUser.getIdToken();

  const headers = new Headers();

  // Jeśli wejście jest obiektem Request, zachowaj jego nagłówki
  if (typeof Request !== 'undefined' && input instanceof Request) {
    input.headers.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  // Dołącz i nadpisz nagłówki z init
  if (init?.headers) {
    const initHeaders = new Headers(init.headers);
    initHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  // Wymuś autorytatywny nagłówek Authorization
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
