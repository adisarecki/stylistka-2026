import type { Firestore, Transaction } from 'firebase-admin/firestore';

export const INITIAL_FREE_TRY_ON_CREDITS = 3;

export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UserCreditsWallet {
  grantedCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export type OperationStatus = 'reserved' | 'consumed' | 'refunded';

export interface TryOnOperation {
  operationId: string;
  uid: string;
  requestId: string;
  status: OperationStatus;
  cacheKey: string;
  createdAt: number;
  updatedAt: number;
  refundReason?: string;
}

export class CreditsInvariantError extends Error {
  readonly code = 'CREDITS_INVARIANT_VIOLATION';
  constructor(message: string) {
    super(`[CREDITS_INVARIANT] ${message}`);
    this.name = 'CreditsInvariantError';
    Object.setPrototypeOf(this, CreditsInvariantError.prototype);
  }
}

/**
 * Rygorystyczna walidacja formatu requestId (standardowy UUID v4, max 36 znaków).
 */
export function isValidRequestId(requestId: unknown): requestId is string {
  if (typeof requestId !== 'string') {
    return false;
  }
  const trimmed = requestId.trim();
  if (trimmed.length !== 36) {
    return false;
  }
  return UUID_V4_REGEX.test(trimmed);
}

/**
 * Oblicza liczbę dostępnych kredytów w portfelu.
 * Invariant: available = granted - reserved - consumed.
 */
export function calculateAvailableCredits(wallet: Readonly<UserCreditsWallet>): number {
  assertWalletInvariants(wallet);
  return wallet.grantedCredits - wallet.reservedCredits - wallet.consumedCredits;
}

/**
 * Weryfikuje niezmienniki portfela kredytów.
 */
export function assertWalletInvariants(wallet: Readonly<UserCreditsWallet>): void {
  if (
    typeof wallet.grantedCredits !== 'number' ||
    typeof wallet.reservedCredits !== 'number' ||
    typeof wallet.consumedCredits !== 'number'
  ) {
    throw new CreditsInvariantError('Liczby kredytów w portfelu muszą być typu number.');
  }

  if (wallet.grantedCredits < 0) {
    throw new CreditsInvariantError(`grantedCredits ujemne: ${wallet.grantedCredits}`);
  }
  if (wallet.reservedCredits < 0) {
    throw new CreditsInvariantError(`reservedCredits ujemne: ${wallet.reservedCredits}`);
  }
  if (wallet.consumedCredits < 0) {
    throw new CreditsInvariantError(`consumedCredits ujemne: ${wallet.consumedCredits}`);
  }
  if (wallet.reservedCredits + wallet.consumedCredits > wallet.grantedCredits) {
    throw new CreditsInvariantError(
      `Suma reserved (${wallet.reservedCredits}) + consumed (${wallet.consumedCredits}) przekracza granted (${wallet.grantedCredits}).`
    );
  }
}

export type ReservationResult =
  | { ok: true; reservation: { operationId: string; uid: string; requestId: string } }
  | { ok: false; error: 'CREDIT_REQUIRED'; available: number; status: 402; message: string }
  | { ok: false; error: 'TRY_ON_IN_PROGRESS'; status: 409; message: string }
  | { ok: false; error: 'OPERATION_ALREADY_COMPLETED'; status: 409; message: string }
  | { ok: false; error: 'REQUEST_ALREADY_REFUNDED'; status: 409; message: string }
  | { ok: false; error: 'IDEMPOTENCY_KEY_REUSED'; status: 409; message: string }
  | { ok: false; error: 'INVALID_REQUEST_ID'; status: 400; message: string }
  | { ok: false; error: 'CREDITS_SYSTEM_ERROR'; status: 500; message: string };

export type FinalizeResult =
  | { ok: true; operationId: string }
  | { ok: false; error: string; code: string };

export type RefundResult =
  | { ok: true; operationId: string; alreadyRefunded: boolean }
  | { ok: false; error: string; code: string };

/**
 * Zwraca bezpieczny klucz dokumentu operacji: `${uid}_${requestId}`
 */
export function getOperationDocId(uid: string, requestId: string): string {
  return `${uid}_${requestId}`;
}

/**
 * Atomowa rezerwacja kredytu w Firestore Transaction.
 */
export async function reserveTryOnCredit(
  adminDb: Firestore,
  uid: string,
  requestId: string,
  cacheKey: string
): Promise<ReservationResult> {
  if (!isValidRequestId(requestId)) {
    return {
      ok: false,
      error: 'INVALID_REQUEST_ID',
      status: 400,
      message: 'Identyfikator żądania (requestId) musi być poprawnym UUID v4.',
    };
  }

  const walletRef = adminDb.collection('user_credits').doc(uid);
  const operationId = getOperationDocId(uid, requestId);
  const operationRef = adminDb.collection('try_on_operations').doc(operationId);

  try {
    return await adminDb.runTransaction(async (transaction: Transaction) => {
      const now = Date.now();

      // 1. Sprawdzenie istniejącej operacji pod kątem idempotencji i spójności cacheKey
      const opDoc = await transaction.get(operationRef);
      if (opDoc.exists) {
        const opData = opDoc.data() as TryOnOperation;

        if (opData.cacheKey && opData.cacheKey !== cacheKey) {
          return {
            ok: false,
            error: 'IDEMPOTENCY_KEY_REUSED',
            status: 409,
            message: 'Identyfikator requestId został już użyty dla innego zestawu parametrów generacji.',
          };
        }

        if (opData.status === 'reserved') {
          return {
            ok: false,
            error: 'TRY_ON_IN_PROGRESS',
            status: 409,
            message: 'Przymiarka dla tego żądania jest już w toku.',
          };
        }
        if (opData.status === 'consumed') {
          return {
            ok: false,
            error: 'OPERATION_ALREADY_COMPLETED',
            status: 409,
            message: 'To żądanie przymiarki zostało już pomyślnie zrealizowane.',
          };
        }
        if (opData.status === 'refunded') {
          return {
            ok: false,
            error: 'REQUEST_ALREADY_REFUNDED',
            status: 409,
            message: 'To żądanie przymiarki zostało wycofane. Wygeneruj nowe żądanie dla nowej próby.',
          };
        }
      }

      // 2. Odczyt lub inicjalizacja portfela użytkownika
      const walletDoc = await transaction.get(walletRef);
      let wallet: UserCreditsWallet;

      if (!walletDoc.exists) {
        wallet = {
          grantedCredits: INITIAL_FREE_TRY_ON_CREDITS,
          reservedCredits: 0,
          consumedCredits: 0,
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        const data = walletDoc.data() as Partial<UserCreditsWallet>;
        wallet = {
          grantedCredits: typeof data.grantedCredits === 'number' ? data.grantedCredits : INITIAL_FREE_TRY_ON_CREDITS,
          reservedCredits: typeof data.reservedCredits === 'number' ? data.reservedCredits : 0,
          consumedCredits: typeof data.consumedCredits === 'number' ? data.consumedCredits : 0,
          schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 1,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : now,
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now,
        };
      }

      // 3. Obliczenie i weryfikacja dostępnych środków
      const available = calculateAvailableCredits(wallet);
      if (available <= 0) {
        // Jeśli portfel był nowy, zapisujemy go aby utrwalić stan
        if (!walletDoc.exists) {
          transaction.set(walletRef, wallet);
        }
        return {
          ok: false,
          error: 'CREDIT_REQUIRED',
          available: 0,
          status: 402,
          message: 'Brak dostępnych kredytów na wirtualną przymiarkę.',
        };
      }

      // 4. Atomowa rezerwacja
      wallet.reservedCredits += 1;
      wallet.updatedAt = now;
      assertWalletInvariants(wallet);

      transaction.set(walletRef, wallet);

      const newOp: TryOnOperation = {
        operationId,
        uid,
        requestId,
        status: 'reserved',
        cacheKey,
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(operationRef, newOp);

      return {
        ok: true,
        reservation: {
          operationId,
          uid,
          requestId,
        },
      };
    });
  } catch (err: unknown) {
    console.error('[TRY-ON-CREDITS] Błąd podczas transakcyjnej rezerwacji kredytu:', err);
    return {
      ok: false,
      error: 'CREDITS_SYSTEM_ERROR',
      status: 500,
      message: 'Wewnętrzny błąd weryfikacji kredytów przymiarki.',
    };
  }
}

/**
 * Atomowa finalizacja operacji (reserved -> consumed) w Firestore Transaction.
 */
export async function finalizeTryOnCredit(
  adminDb: Firestore,
  uid: string,
  requestId: string
): Promise<FinalizeResult> {
  const walletRef = adminDb.collection('user_credits').doc(uid);
  const operationId = getOperationDocId(uid, requestId);
  const operationRef = adminDb.collection('try_on_operations').doc(operationId);

  try {
    return await adminDb.runTransaction(async (transaction: Transaction) => {
      const now = Date.now();

      const opDoc = await transaction.get(operationRef);
      if (!opDoc.exists) {
        return { ok: false, error: 'Nie znaleziono operacji do finalizacji.', code: 'OPERATION_NOT_FOUND' };
      }

      const opData = opDoc.data() as TryOnOperation;
      if (opData.status === 'consumed') {
        // Idempotentny sukces
        return { ok: true, operationId };
      }

      if (opData.status !== 'reserved') {
        return {
          ok: false,
          error: `Nie można sfinalizować operacji ze statusem: ${opData.status}`,
          code: 'INVALID_OPERATION_STATE',
        };
      }

      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) {
        return { ok: false, error: 'Nie znaleziono portfela użytkownika.', code: 'WALLET_NOT_FOUND' };
      }

      const wallet = walletDoc.data() as UserCreditsWallet;
      assertWalletInvariants(wallet);

      if (wallet.reservedCredits <= 0) {
        throw new CreditsInvariantError('Brak aktywnych rezerwacji do finalizacji.');
      }

      wallet.reservedCredits -= 1;
      wallet.consumedCredits += 1;
      wallet.updatedAt = now;
      assertWalletInvariants(wallet);

      transaction.set(walletRef, wallet);
      transaction.update(operationRef, {
        status: 'consumed',
        updatedAt: now,
      });

      return { ok: true, operationId };
    });
  } catch (err: unknown) {
    console.error('[TRY-ON-CREDITS] Błąd podczas finalizacji kredytu:', err);
    return {
      ok: false,
      error: 'Błąd transakcji finalizacji kredytu.',
      code: 'FINALIZE_TRANSACTION_FAILED',
    };
  }
}

/**
 * Atomowy, idempotentny zwrot rezerwacji (reserved -> refunded) w Firestore Transaction.
 */
export async function refundTryOnCredit(
  adminDb: Firestore,
  uid: string,
  requestId: string,
  reason = 'SYSTEM_REFUND'
): Promise<RefundResult> {
  const walletRef = adminDb.collection('user_credits').doc(uid);
  const operationId = getOperationDocId(uid, requestId);
  const operationRef = adminDb.collection('try_on_operations').doc(operationId);

  try {
    return await adminDb.runTransaction(async (transaction: Transaction) => {
      const now = Date.now();

      const opDoc = await transaction.get(operationRef);
      if (!opDoc.exists) {
        return { ok: false, error: 'Nie znaleziono operacji do zwrotu.', code: 'OPERATION_NOT_FOUND' };
      }

      const opData = opDoc.data() as TryOnOperation;

      // Idempotencja: jeśli operacja została już zrefundowana, nie odejmujemy ponownie z reserved
      if (opData.status === 'refunded') {
        return { ok: true, operationId, alreadyRefunded: true };
      }

      // Zakaz: nie wolno refundować operacji, która została już pomyślnie skonsumowana
      if (opData.status === 'consumed') {
        return {
          ok: false,
          error: 'Nie można zwrócić operacji, która została już pomyślnie zrealizowana (consumed).',
          code: 'CANNOT_REFUND_CONSUMED_OPERATION',
        };
      }

      if (opData.status !== 'reserved') {
        return {
          ok: false,
          error: `Nieprawidłowy status operacji do zwrotu: ${opData.status}`,
          code: 'INVALID_STATUS_FOR_REFUND',
        };
      }

      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) {
        return { ok: false, error: 'Nie znaleziono portfela użytkownika.', code: 'WALLET_NOT_FOUND' };
      }

      const wallet = walletDoc.data() as UserCreditsWallet;
      assertWalletInvariants(wallet);

      if (wallet.reservedCredits <= 0) {
        throw new CreditsInvariantError('Brak zarezerwowanych środków do zwrotu w portfelu.');
      }

      wallet.reservedCredits -= 1;
      wallet.updatedAt = now;
      assertWalletInvariants(wallet);

      transaction.set(walletRef, wallet);
      transaction.update(operationRef, {
        status: 'refunded',
        refundReason: reason,
        updatedAt: now,
      });

      return { ok: true, operationId, alreadyRefunded: false };
    });
  } catch (err: unknown) {
    console.error('[TRY-ON-CREDITS] Błąd podczas transakcyjnego zwrotu kredytu:', err);
    return {
      ok: false,
      error: 'Błąd transakcji zwrotu kredytu.',
      code: 'REFUND_TRANSACTION_FAILED',
    };
  }
}
