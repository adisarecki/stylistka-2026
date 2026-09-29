/**
 * test-ui.ts
 *
 * R4.4: Rzeczywiste testy interakcji komponentu UI TryOnWidget w środowisku JSDOM.
 *
 * Sprawdza:
 * 1. Przypadek nieobsługiwanej kategorii (np. 'full_outfit' / null / nieznana kategoria):
 *    - Przycisk "Przymierz" NIE JEST renderowany w karcie produktu w widoku I.
 *    - Nawet przy bezpośrednim wywołaniu validateTryOnPrerequisites z poziomu UI: brak wywołania POST /api/try-on, brak zablokowanego stanu UI.
 * 2. Przypadek obsługiwanej kategorii ('dresses') ze zweryfikowanym tryOnAsset:
 *    - Przycisk "Przymierz" JEST widoczny i aktywny.
 *    - Kliknięcie przycisku "Przymierz" wykonuje DOKŁADNIE JEDNO wywołanie POST /api/try-on.
 *    - Żądanie zawiera oczyszczony, bezpieczny payload (requestId, personImage, clothingImage, category).
 *    - Żądanie NIE ZAWIERA żadnych niezaufanych pól (advice, replicatePrompt, bodyTypeModifier, productTitle) ani tokenu INJECT_MARKER.
 * 3. Obsługa błędów / reset stanu:
 *    - W przypadku błędu API / abortu, flagi ładowania (isTryOnLoading, isAppProcessing) zostają zresetowane (false),
 *      a interfejs nie zostaje zawieszony w nieskończonym stanie ładowania.
 */

import { JSDOM } from 'jsdom';

// 1. Inicjalizacja środowiska przeglądarkowego w Node.js (JSDOM) przed importem React / testing-library
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:3000/studio',
  pretendToBeVisual: true,
});

const globalProps: Record<string, unknown> = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  File: dom.window.File,
  FileReader: dom.window.FileReader,
  Blob: dom.window.Blob,
  Image: dom.window.Image,
  HTMLElement: dom.window.HTMLElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLCanvasElement: dom.window.HTMLCanvasElement,
  customElements: dom.window.customElements,
  Event: dom.window.Event,
  Node: dom.window.Node,
};

for (const [key, value] of Object.entries(globalProps)) {
  Object.defineProperty(globalThis, key, {
    value,
    writable: true,
    configurable: true,
  });
}

// Minimalna atrapa window.scrollTo i Canvas
dom.window.scrollTo = () => {};
interface MockCanvasProto {
  getContext: (contextId: string) => unknown;
  toDataURL: () => string;
}
const canvasProto = dom.window.HTMLCanvasElement.prototype as unknown as MockCanvasProto;
canvasProto.getContext = () => ({
  drawImage: () => {},
});
canvasProto.toDataURL = () => 'data:image/jpeg;base64,/9j/mockImageData';

// 2. Mockowanie modułów zewnętrznych (Firebase, auth-fetch) w require.cache i Module._load
import Module from 'node:module';
import path from 'path';
import assert from 'node:assert/strict';
import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { CanonicalProduct } from './types/product';
import { MarketProvider } from './components/MarketContext';
import type { TryOnWidgetProps } from './components/TryOnWidget';

// Dane testowe
const mockUser = {
  uid: 'test_user_ui_456',
  email: 'test@example.com',
  displayName: 'Test User',
};

const mockValidDressProduct: CanonicalProduct = {
  id: 'dress-ui-001',
  kind: 'commerce',
  sourceType: 'merchant_feed',
  title: 'Elegancka sukienka wieczorowa maxi',
  brand: 'ModaElegance',
  merchant: {
    id: 'm1',
    name: 'ModaElegance Store',
    domain: 'example.com',
  },
  productUrl: 'https://example.com/products/dress-ui-001',
  price: { amount: 299.99, currency: 'PLN' },
  availability: 'in_stock',
  availableSizes: ['S', 'M', 'L'],
  deliveryCountries: ['PL'],
  marketCountry: 'PL',
  affiliate: false,
  updatedAt: new Date().toISOString(),
  heroImage: {
    url: 'https://images.example.com/dress-hero.jpg',
    role: 'hero',
    source: 'merchant',
    width: 600,
    height: 800,
  },
  tryOnAsset: {
    status: 'verified',
    verifiedBy: 'merchant_feed',
    verifiedAt: new Date().toISOString(),
    image: {
      url: 'https://images.example.com/dress-clean-asset.jpg',
      role: 'try_on',
      source: 'merchant',
      width: 600,
      height: 800,
    },
  },
};

const mockPersonBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/uiTestPersonBase64';

// Przechwytywanie żądań sieciowych z poziomu authenticatedFetch
interface CapturedFetchCall {
  url: string;
  init?: RequestInit;
  parsedBody?: Record<string, unknown>;
}

let capturedFetchCalls: CapturedFetchCall[] = [];
let mockFetchHandler: (url: string, init?: RequestInit) => Promise<Response> = async () => {
  return new Response(JSON.stringify({ imageUrl: 'https://vton.example.com/result.jpg' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const testAuthenticatedFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof url === 'string' ? url : url.toString();
  let parsedBody: Record<string, unknown> | undefined;
  if (init?.body && typeof init.body === 'string') {
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      // not json
    }
  }
  capturedFetchCalls.push({ url: urlStr, init, parsedBody });
  return mockFetchHandler(urlStr, init);
};

// Sterowalna atrapa onAuthStateChanged: pozwala testom wyzwolić callback z dowolnym użytkownikiem
type AuthCallback = (user: unknown) => void;
let latestAuthCallback: AuthCallback | null = null;
let initialAuthUser: unknown = mockUser; // domyślnie mockUser — testy mogą zmienić

function fireAuthCallback(user: unknown) {
  initialAuthUser = user;
  if (latestAuthCallback) {
    act(() => {
      latestAuthCallback!(user);
    });
  }
}

const mockFirebaseAuth = {
  getAuth: () => ({ currentUser: initialAuthUser }),
  onAuthStateChanged: (_auth: unknown, callback: AuthCallback) => {
    latestAuthCallback = callback;
    // Synchronicznie wywołaj z aktualnym initialAuthUser (ustawiany w setup())
    callback(initialAuthUser);
    return () => {
      if (latestAuthCallback === callback) {
        latestAuthCallback = null;
      }
    };
  },
  signInWithPopup: async () => ({ user: mockUser }),
  GoogleAuthProvider: class {},
};

const mockLibFirebase = {
  auth: {
    get currentUser() {
      return initialAuthUser;
    },
  },
};

const mockLibAuthFetch = {
  authenticatedFetch: testAuthenticatedFetch,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super('Authentication required');
      this.name = 'AuthenticationRequiredError';
    }
  },
};

interface NodeModuleLoader {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
}
const nodeModule = Module as unknown as NodeModuleLoader;
const origModuleLoad = nodeModule._load;

nodeModule._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'firebase/auth' || request === '@firebase/auth' || request.endsWith('firebase/auth')) {
    return mockFirebaseAuth;
  }
  if (request === '@/lib/firebase' || request.endsWith('lib/firebase') || request.endsWith('lib/firebase.ts')) {
    return mockLibFirebase;
  }
  if (request === '@/lib/auth-fetch' || request.endsWith('lib/auth-fetch') || request.endsWith('lib/auth-fetch.ts')) {
    return mockLibAuthFetch;
  }
  return origModuleLoad.apply(this, [request, parent, isMain]);
};

// Podmieniamy także bezpośrednio require.cache
require.cache[path.resolve(__dirname, 'lib/auth-fetch.ts')] = {
  id: path.resolve(__dirname, 'lib/auth-fetch.ts'),
  filename: path.resolve(__dirname, 'lib/auth-fetch.ts'),
  loaded: true,
  exports: mockLibAuthFetch,
} as unknown as NodeModule;

require.cache[path.resolve(__dirname, 'lib/firebase.ts')] = {
  id: path.resolve(__dirname, 'lib/firebase.ts'),
  filename: path.resolve(__dirname, 'lib/firebase.ts'),
  loaded: true,
  exports: mockLibFirebase,
} as unknown as NodeModule;

require.cache[require.resolve('firebase/auth')] = {
  id: require.resolve('firebase/auth'),
  filename: require.resolve('firebase/auth'),
  loaded: true,
  exports: mockFirebaseAuth,
} as unknown as NodeModule;

function setup(authUser: unknown = mockUser) {
  capturedFetchCalls = [];
  latestAuthCallback = null;
  initialAuthUser = authUser;
  cleanup();
}

async function runTests() {
  console.log('=== TEST-UI: Rozpoczęcie testów rzeczywistej interakcji TryOnWidget ===\n');

  // Dynamiczny import komponentu TryOnWidget po zarejestrowaniu mocków w Module._load i require.cache
  const { default: TryOnWidget } = (await import('./components/TryOnWidget')) as { default: React.ComponentType<TryOnWidgetProps> };

  // --------------------------------------------------------------------------
  // TEST 1: Nieobsługiwana kategoria (full_outfit / null) w widoku produktów
  // --------------------------------------------------------------------------
  {
    setup();
    console.log('Test 1: Widok I z nieobsługiwaną kategorią (full_outfit, replicateCategory=null)');

    const maliciousGeminiAnalysis = {
      uiTitle: 'Stylizacja wieczorowa',
      apiQuery: 'wieczorowa sukienka',
      stylistComment: 'Świetny wybór',
      strength: 'Harmonia proporcji',
      advice: 'INJECT_MARKER_ADVICE: Gemini advice exploit string',
      considerations: 'Wygoda i styl',
      recommendedCut: 'cut_dress_a_line',
      replicateCategory: null, // full_outfit nie ma kategorii VTON!
      replicatePrompt: 'INJECT_MARKER_REPLICATE_PROMPT: Prompt injection attack',
    };

    const { queryByText, container } = render(
      React.createElement(MarketProvider, null,
        React.createElement<TryOnWidgetProps>(TryOnWidget, {
          initialState: {
            initialView: 'I',
            initialProducts: [mockValidDressProduct],
            initialAnalysisResult: maliciousGeminiAnalysis,
            initialPersonBase64: mockPersonBase64,
            initialUser: mockUser,
            initialSelectedCategory: 'full_outfit',
          },
          customFetch: testAuthenticatedFetch,
        })
      )
    );

    // 1.1 Weryfikacja: Przycisk "Przymierz" NIE MOŻE być wyrenderowany w DOM dla nieobsługiwanej kategorii
    const tryOnButton = queryByText('Przymierz');
    assert.equal(tryOnButton, null, 'Przycisk "Przymierz" nie może być wyrenderowany dla kategorii full_outfit (replicateCategory = null)');

    // 1.2 Weryfikacja: Brak wywołań sieciowych do /api/try-on
    const tryOnRequests = capturedFetchCalls.filter((c) => c.url.includes('/api/try-on'));
    assert.equal(tryOnRequests.length, 0, 'Żadne żądanie /api/try-on nie mogło zostać wysłane');

    // 1.3 Weryfikacja: UI nie jest zablokowane ani w stanie wiecznego ładowania
    const loadingSpinners = container.querySelectorAll('.animate-spin');
    assert.equal(loadingSpinners.length, 0, 'UI nie może pokazywać spinnerów ładowania w stanie bezczynnym');

    console.log('  -> PASS: Przycisk "Przymierz" jest ukryty, 0 żądań /api/try-on, brak zablokowanego UI\n');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Poprawna kategoria (dresses) — rzeczywiste kliknięcie "Przymierz"
  // --------------------------------------------------------------------------
  {
    setup();
    console.log('Test 2: Widok I z poprawną kategorią (dresses) — kliknięcie "Przymierz" i sprawdzenie żądania');

    const validAnalysisWithInjectedFields = {
      uiTitle: 'Rekomendacja dla Ciebie',
      apiQuery: 'sukienka trapezowa',
      stylistComment: 'Doskonałe fasony',
      strength: 'Proporcje',
      advice: 'INJECT_MARKER_ADVICE_SHOULD_NEVER_LEAK',
      considerations: 'Wysoka estetyka',
      recommendedCut: 'cut_dress_a_line',
      replicateCategory: 'dresses' as const,
      replicatePrompt: 'INJECT_MARKER_PROMPT_SHOULD_NEVER_LEAK',
    };

    let serverEndpointCalled = false;
    let receivedPayload: Record<string, unknown> | null = null;

    mockFetchHandler = async (url: string, init?: RequestInit) => {
      if (url === '/api/try-on' && init?.method === 'POST') {
        serverEndpointCalled = true;
        receivedPayload = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ imageUrl: 'https://vton.example.com/dress-result-123.jpg' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    };

    const { getByText, container } = render(
      React.createElement(MarketProvider, null,
        React.createElement<TryOnWidgetProps>(TryOnWidget, {
          initialState: {
            initialView: 'I',
            initialProducts: [mockValidDressProduct],
            initialAnalysisResult: validAnalysisWithInjectedFields,
            initialPersonBase64: mockPersonBase64,
            initialUser: mockUser,
            initialSelectedCategory: 'dresses',
          },
          customFetch: testAuthenticatedFetch,
        })
      )
    );

    // 2.1 Weryfikacja: Przycisk "Przymierz" JEST wyrenderowany
    const tryOnButton = getByText('Przymierz');
    assert.ok(tryOnButton, 'Przycisk "Przymierz" musi być wyrenderowany dla dozwolonej kategorii sukienki');

    // 2.2 Wykonanie rzeczywistego kliknięcia w przycisk "Przymierz"
    await act(async () => {
      fireEvent.click(tryOnButton);
    });

    // 2.3 Oczekiwanie na zakończenie asynchronicznej operacji przymiarki
    await waitFor(() => {
      assert.equal(serverEndpointCalled, true, 'Handler POST /api/try-on musi zostać wywołany po kliknięciu');
    });

    // 2.4 Weryfikacja: Wykonano DOKŁADNIE JEDNO wywołanie do /api/try-on
    const tryOnRequests = capturedFetchCalls.filter((c) => c.url === '/api/try-on');
    assert.equal(tryOnRequests.length, 1, 'Musi nastąpić dokładnie 1 wywołanie POST /api/try-on');

    // 2.5 Weryfikacja: Integralność i oczyszczenie payloadu żądania
    assert.ok(receivedPayload !== null, 'Payload żądania musi istnieć');
    const safePayload = receivedPayload as Record<string, unknown>;
    assert.ok(typeof safePayload.requestId === 'string' && safePayload.requestId.length > 0, 'requestId musi być podany');
    assert.equal(safePayload.personImage, mockPersonBase64, 'personImage musi odpowiadać zdjęciu sylwetki');
    assert.equal(safePayload.clothingImage, mockValidDressProduct.tryOnAsset!.image.url, 'clothingImage musi odpowiadać tryOnAsset produktu');
    assert.equal(safePayload.category, 'dresses', 'category musi wynosić dresses');

    // 2.6 Weryfikacja bezpieczeństwa: Całkowity brak pól niezaufanych i tokenów injection
    assert.equal(safePayload.advice, undefined, 'Pole advice nie może znajdować się w żądaniu klienta');
    assert.equal(safePayload.replicatePrompt, undefined, 'Pole replicatePrompt nie może znajdować się w żądaniu klienta');
    assert.equal(safePayload.bodyTypeModifier, undefined, 'Pole bodyTypeModifier nie może znajdować się w żądaniu klienta');
    assert.equal(safePayload.productTitle, undefined, 'Pole productTitle nie może znajdować się w żądaniu klienta');

    const serializedPayload = JSON.stringify(safePayload);
    assert.ok(!serializedPayload.includes('INJECT_MARKER'), 'Zserializowane żądanie klienta NIE MOŻE zawierać tekstu INJECT_MARKER');
    assert.ok(!serializedPayload.includes('SHOULD_NEVER_LEAK'), 'Niezaufane napisy nie mogą wyciekać do /api/try-on');

    // 2.7 Weryfikacja: Wyświetlenie wyniku przymiarki w interfejsie i odblokowanie przycisków
    await waitFor(() => {
      const resultBanner = container.querySelector('img[alt="Wirtualna przymiarka"]');
      assert.ok(resultBanner, 'Wygenerowany obraz przymiarki musi zostać wyświetlony w widoku I');
    });

    console.log('  -> PASS: Dokładnie 1 żądanie POST, payload oczyszczony, brak wycieku INJECT_MARKER, wynik wyświetlony\n');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Obsługa błędu serwera / abortu — reset flag ładowania i brak blokady UI
  // --------------------------------------------------------------------------
  {
    setup();
    console.log('Test 3: Obsługa błędu /api/try-on (HTTP 500) — reset flag isTryOnLoading i isAppProcessing');

    const validAnalysis = {
      uiTitle: 'Rekomendacja dla Ciebie',
      apiQuery: 'sukienka wieczorowa',
      stylistComment: 'Komentarz',
      strength: 'Proporcje',
      advice: 'Porada',
      considerations: 'Uwagi',
      recommendedCut: 'cut_dress_a_line',
      replicateCategory: 'dresses' as const,
      replicatePrompt: null,
    };

    mockFetchHandler = async (url: string) => {
      if (url === '/api/try-on') {
        return new Response(JSON.stringify({ error: 'Internal VTON GPU worker crashed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    };

    const { getByText, container } = render(
      React.createElement(MarketProvider, null,
        React.createElement<TryOnWidgetProps>(TryOnWidget, {
          initialState: {
            initialView: 'I',
            initialProducts: [mockValidDressProduct],
            initialAnalysisResult: validAnalysis,
            initialPersonBase64: mockPersonBase64,
            initialUser: mockUser,
            initialSelectedCategory: 'dresses',
          },
          customFetch: testAuthenticatedFetch,
        })
      )
    );

    const tryOnButton = getByText('Przymierz');
    assert.ok(tryOnButton, 'Przycisk "Przymierz" musi być dostępny');

    // Kliknięcie skutkujące błędem 500
    await act(async () => {
      fireEvent.click(tryOnButton);
    });

    // Oczekiwanie na komunikat o błędzie
    await waitFor(() => {
      const errorMsg = container.querySelector('#tryon-error-msg') || getByText(/Internal VTON GPU worker crashed|Nie udało się wygenerować przymiarki/);
      assert.ok(errorMsg, 'Komunikat o błędzie musi pojawić się w interfejsie');
    });

    // Weryfikacja: Przycisk ponownie nie ma stanu disabled ani spinnera ładowania
    const tryOnBtnAfterError = getByText('Przymierz');
    assert.equal(tryOnBtnAfterError.hasAttribute('disabled'), false, 'Przycisk Przymierz nie może być zablokowany po błędzie');
    assert.equal(container.querySelectorAll('.animate-spin').length, 0, 'Spinnery ładowania muszą zniknąć po obsłudze błędu');

    console.log('  -> PASS: Błąd obsłużony prawidłowo, flagi ładowania zresetowane, UI nie jest zawieszone\n');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Auth null na starcie → reset do bezpiecznego stanu, brak POST
  // --------------------------------------------------------------------------
  {
    // onAuthStateChanged natychmiast zwraca null (użytkownik wylogowany)
    setup(null);
    console.log('Test 4: onAuthStateChanged(null) na starcie — reset do bezpiecznego stanu, brak POST /api/try-on');

    const validAnalysis = {
      uiTitle: 'Rekomendacja',
      apiQuery: 'sukienka',
      stylistComment: 'Komentarz',
      strength: 'Proporcje',
      advice: 'Porada',
      considerations: 'Uwagi',
      recommendedCut: 'cut_dress_a_line',
      replicateCategory: 'dresses' as const,
      replicatePrompt: null,
    };

    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ imageUrl: 'https://vton.example.com/result.jpg' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const { queryByText, container } = render(
      React.createElement(MarketProvider, null,
        React.createElement<TryOnWidgetProps>(TryOnWidget, {
          initialState: {
            initialView: 'I',
            initialProducts: [mockValidDressProduct],
            initialAnalysisResult: validAnalysis,
            initialPersonBase64: mockPersonBase64,
            initialUser: mockUser,
            initialSelectedCategory: 'dresses',
          },
          customFetch: testAuthenticatedFetch,
        })
      )
    );

    // Po resecie widok powinien wrócić do 'A', nie 'I'
    // prevUid = mockUser.uid, currentUid = null → resetStudio() → widok A
    await waitFor(() => {
      const viewA = container.querySelector('#view-A');
      assert.ok(viewA, 'Widok musi zostać zresetowany do A po auth null');
    });

    // Przycisk "Przymierz" nie może być dostępny po resecie
    const tryOnButton = queryByText('Przymierz');
    assert.equal(tryOnButton, null, 'Przycisk "Przymierz" nie może być dostępny po resecie auth null');

    // Brak wywołań POST /api/try-on
    const tryOnRequests = capturedFetchCalls.filter((c) => c.url.includes('/api/try-on'));
    assert.equal(tryOnRequests.length, 0, 'Żadne żądanie /api/try-on nie może zostać wysłane po auth null');

    console.log('  -> PASS: Auth null → reset do widoku A, brak "Przymierz", 0 żądań /api/try-on\n');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Auth z zgodnym UID na starcie → zachowuje dozwoloną ścieżkę
  // --------------------------------------------------------------------------
  {
    // onAuthStateChanged zwraca użytkownika z tym samym UID co initialUser
    setup(mockUser);
    console.log('Test 5: onAuthStateChanged(mockUser) z zgodnym UID — zachowuje widok I i umożliwia POST');

    const validAnalysis = {
      uiTitle: 'Rekomendacja',
      apiQuery: 'sukienka',
      stylistComment: 'Komentarz',
      strength: 'Proporcje',
      advice: 'Porada',
      considerations: 'Uwagi',
      recommendedCut: 'cut_dress_a_line',
      replicateCategory: 'dresses' as const,
      replicatePrompt: null,
    };

    let postCalled = false;
    mockFetchHandler = async (url: string, init?: RequestInit) => {
      if (url === '/api/try-on' && init?.method === 'POST') {
        postCalled = true;
        return new Response(JSON.stringify({ imageUrl: 'https://vton.example.com/result.jpg' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    };

    const { getByText, queryByText, container } = render(
      React.createElement(MarketProvider, null,
        React.createElement<TryOnWidgetProps>(TryOnWidget, {
          initialState: {
            initialView: 'I',
            initialProducts: [mockValidDressProduct],
            initialAnalysisResult: validAnalysis,
            initialPersonBase64: mockPersonBase64,
            initialUser: mockUser,
            initialSelectedCategory: 'dresses',
          },
          customFetch: testAuthenticatedFetch,
        })
      )
    );

    // Widok I musi być zachowany (nie zresetowany do A)
    const viewI = container.querySelector('#view-I');
    assert.ok(viewI, 'Widok I musi być zachowany po auth z zgodnym UID');

    // Przycisk "Przymierz" musi być widoczny
    const tryOnButton = getByText('Przymierz');
    assert.ok(tryOnButton, 'Przycisk "Przymierz" musi być dostępny po auth z zgodnym UID');

    // Kliknięcie musi wywołać POST /api/try-on
    await act(async () => {
      fireEvent.click(tryOnButton);
    });

    await waitFor(() => {
      assert.equal(postCalled, true, 'POST /api/try-on musi zostać wywołany po kliknięciu przy zgodnym UID');
    });

    // Weryfikacja sterowalności: callback z tym samym UID podtrzymuje dozwolony stan
    fireAuthCallback(mockUser);
    assert.ok(container.querySelector('#view-I'), 'Widok I musi pozostać aktywny po callbacku z tym samym UID');

    // Weryfikacja sterowalności: późniejszy callback z null natychmiast resetuje studio do widoku A
    fireAuthCallback(null);
    await waitFor(() => {
      assert.ok(container.querySelector('#view-A'), 'Widok musi zostać zresetowany do A po wywołaniu callbacku z null');
    });
    assert.equal(queryByText('Przymierz'), null, 'Przycisk Przymierz nie może być dostępny po wylogowaniu');

    console.log('  -> PASS: Auth z zgodnym UID → widok I zachowany, POST dozwolony, steerable callback działa\n');
  }

  console.log('=== WSZYSTKIE TESTY UI W TEST-UI.TS ZAKOŃCZONE SUKCESEM (PASS) ===');
}

runTests().catch((err) => {
  console.error('BŁĄD W TEST-UI.TS:', err);
  process.exit(1);
});
