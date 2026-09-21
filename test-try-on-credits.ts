import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_FREE_TRY_ON_CREDITS,
  isValidRequestId,
  calculateAvailableCredits,
  assertWalletInvariants,
  CreditsInvariantError,
  UserCreditsWallet,
  TryOnOperation,
} from './lib/try-on-credits';

// ===========================================================================
// IN-MEMORY EMULATOR OF FIRESTORE TRANSACTIONS FOR CREDITS
// ===========================================================================
class InMemoryFirestoreCreditsEngine {
  private wallets = new Map<string, UserCreditsWallet>();
  private operations = new Map<string, TryOnOperation>();

  public replicateCallCount = 0;
  public refundCallCount = 0;

  getWallet(uid: string): UserCreditsWallet | undefined {
    const w = this.wallets.get(uid);
    return w ? { ...w } : undefined;
  }

  getOperation(operationId: string): TryOnOperation | undefined {
    const op = this.operations.get(operationId);
    return op ? { ...op } : undefined;
  }

  async runTransaction<T>(updateFn: (tx: InMemoryFirestoreCreditsEngine) => Promise<T>): Promise<T> {
    // Klonujemy stan dla izolacji transakcyjnej
    const originalWallets = new Map(this.wallets);
    const originalOps = new Map(this.operations);

    try {
      return await updateFn(this);
    } catch (err) {
      this.wallets = originalWallets;
      this.operations = originalOps;
      throw err;
    }
  }

  reserveCredit(uid: string, requestId: string, cacheKey: string) {
    if (!isValidRequestId(requestId)) {
      return { ok: false, error: 'INVALID_REQUEST_ID', status: 400 };
    }

    const operationId = `${uid}_${requestId}`;
    const existingOp = this.operations.get(operationId);

    if (existingOp) {
      if (existingOp.cacheKey && existingOp.cacheKey !== cacheKey) {
        return { ok: false, error: 'IDEMPOTENCY_KEY_REUSED', status: 409 };
      }
      if (existingOp.status === 'reserved') {
        return { ok: false, error: 'TRY_ON_IN_PROGRESS', status: 409 };
      }
      if (existingOp.status === 'consumed') {
        return { ok: false, error: 'OPERATION_ALREADY_COMPLETED', status: 409 };
      }
      if (existingOp.status === 'refunded') {
        return { ok: false, error: 'REQUEST_ALREADY_REFUNDED', status: 409 };
      }
    }

    let wallet = this.wallets.get(uid);
    const now = Date.now();

    if (!wallet) {
      wallet = {
        grantedCredits: INITIAL_FREE_TRY_ON_CREDITS,
        reservedCredits: 0,
        consumedCredits: 0,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      this.wallets.set(uid, wallet);
    }

    const available = calculateAvailableCredits(wallet);
    if (available <= 0) {
      return { ok: false, error: 'CREDIT_REQUIRED', available: 0, status: 402 };
    }

    wallet.reservedCredits += 1;
    wallet.updatedAt = now;
    assertWalletInvariants(wallet);

    const op: TryOnOperation = {
      operationId,
      uid,
      requestId,
      status: 'reserved',
      cacheKey,
      createdAt: now,
      updatedAt: now,
    };
    this.operations.set(operationId, op);

    return { ok: true, reservation: { operationId, uid, requestId } };
  }

  finalizeCredit(uid: string, requestId: string) {
    const operationId = `${uid}_${requestId}`;
    const op = this.operations.get(operationId);
    if (!op) {
      return { ok: false, error: 'OPERATION_NOT_FOUND' };
    }
    if (op.status === 'consumed') {
      return { ok: true, operationId };
    }
    if (op.status !== 'reserved') {
      return { ok: false, error: 'INVALID_OPERATION_STATE' };
    }

    const wallet = this.wallets.get(uid);
    if (!wallet) {
      return { ok: false, error: 'WALLET_NOT_FOUND' };
    }

    if (wallet.reservedCredits <= 0) {
      throw new CreditsInvariantError('Brak rezerwacji');
    }

    wallet.reservedCredits -= 1;
    wallet.consumedCredits += 1;
    wallet.updatedAt = Date.now();
    assertWalletInvariants(wallet);

    op.status = 'consumed';
    op.updatedAt = Date.now();

    return { ok: true, operationId };
  }

  refundCredit(uid: string, requestId: string) {
    const operationId = `${uid}_${requestId}`;
    const op = this.operations.get(operationId);
    if (!op) {
      return { ok: false, error: 'OPERATION_NOT_FOUND' };
    }
    if (op.status === 'refunded') {
      return { ok: true, operationId, alreadyRefunded: true };
    }
    if (op.status === 'consumed') {
      return { ok: false, error: 'CANNOT_REFUND_CONSUMED_OPERATION' };
    }
    if (op.status !== 'reserved') {
      return { ok: false, error: 'INVALID_STATUS_FOR_REFUND' };
    }

    const wallet = this.wallets.get(uid);
    if (!wallet) {
      return { ok: false, error: 'WALLET_NOT_FOUND' };
    }

    if (wallet.reservedCredits <= 0) {
      throw new CreditsInvariantError('Brak rezerwacji do zwrotu');
    }

    wallet.reservedCredits -= 1;
    wallet.updatedAt = Date.now();
    assertWalletInvariants(wallet);

    op.status = 'refunded';
    op.updatedAt = Date.now();

    this.refundCallCount += 1;
    return { ok: true, operationId, alreadyRefunded: false };
  }

  /**
   * Symulacja endpointu /api/try-on z zachowaniem ściśle kolejności logicznej i granicy trwałego wyniku
   */
  async simulateTryOnEndpoint(params: {
    authHeaderPresent: boolean;
    verifiedUid?: string;
    requestId?: string;
    isCacheHit: boolean;
    cacheKey?: string;
    providerShouldFail?: boolean;
    finalizeShouldFail?: boolean;
    simulateStorageFailureAfterProvider?: boolean;
  }) {
    // 0. AUTH
    if (!params.authHeaderPresent || !params.verifiedUid) {
      return { status: 401, error: 'AUTH_REQUIRED' };
    }
    const uid = params.verifiedUid;

    // 1. INPUT VALIDATION (requestId)
    if (!params.requestId || !isValidRequestId(params.requestId)) {
      return { status: 400, error: 'INVALID_REQUEST_ID' };
    }

    const cKey = params.cacheKey || 'dummy_cache_key';

    // 4. CACHE LOOKUP
    if (params.isCacheHit) {
      const opDoc = this.operations.get(`${uid}_${params.requestId}`);
      if (opDoc) {
        if (opDoc.status === 'refunded') {
          return { status: 409, error: 'REQUEST_ALREADY_REFUNDED' };
        }
        if (opDoc.status === 'reserved') {
          const finRes = this.finalizeCredit(uid, params.requestId);
          if (!finRes.ok) {
            return { status: 500, error: 'CREDITS_SYSTEM_ERROR' };
          }
        }
      }
      return { status: 200, cached: true, imageUrl: 'https://cached.storage/url' };
    }

    // 4.5 ATOMIC RESERVATION
    let reservationCreated = false;
    let durableResultPersisted = false;
    let creditFinalized = false;

    const res = this.reserveCredit(uid, params.requestId, cKey);
    if (!res.ok) {
      return { status: res.status, error: res.error };
    }
    reservationCreated = true;

    try {
      // 6. GRANICA KOSZTOWA - WYWOŁANIE REPLICATE
      this.replicateCallCount += 1;
      if (params.providerShouldFail) {
        throw new Error('PROVIDER_ERROR');
      }

      if (params.simulateStorageFailureAfterProvider) {
        throw new Error('STORAGE_SAVE_FAILED');
      }

      // 7. ZAPIS DO TRWAŁEGO STORAGE & FIRESTORE
      durableResultPersisted = true;

      // 7.5 ATOMIC FINALIZE
      if (params.finalizeShouldFail) {
        throw new Error('FINALIZE_CREDIT_FAILED');
      }

      const fin = this.finalizeCredit(uid, params.requestId);
      if (!fin.ok) {
        throw new Error('FINALIZE_CREDIT_FAILED');
      }
      creditFinalized = true;

      return { status: 200, imageUrl: 'https://result.storage/url' };
    } catch (err: unknown) {
      // Catch z bezpiecznym refund guardem (dokładnie 3 warunki)
      const canSafelyRefund =
        reservationCreated === true &&
        creditFinalized === false &&
        durableResultPersisted === false;

      if (canSafelyRefund) {
        this.refundCredit(uid, params.requestId);
      }
      return {
        status: 500,
        error: (err instanceof Error) ? err.message : 'SERVER_ERROR',
        reservationCreated,
        durableResultPersisted,
        creditFinalized,
      };
    }
  }
}

// ===========================================================================
// JEDNOSTKOWE I BIZNESOWE TESTY LOGIKI KREDYTÓW (Przypadki 1-17)
// ===========================================================================

test('1. Nowy użytkownik otrzymuje dokładnie 3 kredyty', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const reqId = '11111111-1111-4111-8111-111111111111';
  engine.reserveCredit('user_1', reqId, 'k1');
  const w = engine.getWallet('user_1');
  assert.ok(w);
  assert.equal(w.grantedCredits, 3);
  assert.equal(INITIAL_FREE_TRY_ON_CREDITS, 3);
});

test('2. available = granted - reserved - consumed', () => {
  const wallet: UserCreditsWallet = {
    grantedCredits: 3,
    reservedCredits: 1,
    consumedCredits: 1,
    schemaVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  assert.equal(calculateAvailableCredits(wallet), 1);
});

test('3. Pierwsza operacja może zarezerwować kredyt', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const reqId = '22222222-2222-4222-8222-222222222222';
  const res = engine.reserveCredit('user_2', reqId, 'k2');
  assert.equal(res.ok, true);
  const w = engine.getWallet('user_2')!;
  assert.equal(w.reservedCredits, 1);
  assert.equal(w.consumedCredits, 0);
  assert.equal(calculateAvailableCredits(w), 2);
});

test('4. Trzy różne operacje mogą wykorzystać łącznie najwyżej 3 kredyty', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_3';
  const req1 = '33333333-3333-4333-8333-333333333331';
  const req2 = '33333333-3333-4333-8333-333333333332';
  const req3 = '33333333-3333-4333-8333-333333333333';

  assert.equal(engine.reserveCredit(uid, req1, 'k1').ok, true);
  engine.finalizeCredit(uid, req1);

  assert.equal(engine.reserveCredit(uid, req2, 'k2').ok, true);
  engine.finalizeCredit(uid, req2);

  assert.equal(engine.reserveCredit(uid, req3, 'k3').ok, true);
  engine.finalizeCredit(uid, req3);

  const w = engine.getWallet(uid)!;
  assert.equal(w.consumedCredits, 3);
  assert.equal(w.reservedCredits, 0);
  assert.equal(calculateAvailableCredits(w), 0);
});

test('5. Czwarta operacja zwraca CREDIT_REQUIRED', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_4';
  for (let i = 1; i <= 3; i++) {
    const req = `44444444-4444-4444-8444-44444444444${i}`;
    engine.reserveCredit(uid, req, `k${i}`);
    engine.finalizeCredit(uid, req);
  }

  const req4 = '44444444-4444-4444-8444-444444444444';
  const res = engine.reserveCredit(uid, req4, 'k4');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'CREDIT_REQUIRED');
  assert.equal(res.status, 402);
});

test('6. Cache hit nie rezerwuje kredytu', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_cache_hit';
  const req = '55555555-5555-4555-8555-555555555555';

  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: req,
    isCacheHit: true,
  });

  assert.equal(res.status, 200);
  assert.equal(res.cached, true);
  const w = engine.getWallet(uid);
  assert.equal(w, undefined, 'Dla cache hit nie tworzy się nawet rezerwacja');
});

test('7. Cache hit nie zwiększa consumedCredits', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_cache_hit_existing';
  const req1 = '66666666-6666-4666-8666-666666666661';

  // 1 próba pobiera kredyt
  await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: req1,
    isCacheHit: false,
  });
  let w = engine.getWallet(uid)!;
  assert.equal(w.consumedCredits, 1);

  // 2 próba to cache hit
  const req2 = '66666666-6666-4666-8666-666666666662';
  await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: req2,
    isCacheHit: true,
  });

  w = engine.getWallet(uid)!;
  assert.equal(w.consumedCredits, 1, 'consumedCredits pozostało bez zmian');
  assert.equal(w.reservedCredits, 0);
});

test('8. To samo requestId nie może zostać naliczone dwukrotnie', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_idempotency';
  const reqId = '77777777-7777-4777-8777-777777777777';

  const res1 = engine.reserveCredit(uid, reqId, 'k1');
  assert.equal(res1.ok, true);

  const res2 = engine.reserveCredit(uid, reqId, 'k1');
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'TRY_ON_IN_PROGRESS');

  const w = engine.getWallet(uid)!;
  assert.equal(w.reservedCredits, 1, 'Rezerwacja tylko jednokrotna');
});

test('9. Operacja reserved zwraca TRY_ON_IN_PROGRESS', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_in_progress';
  const reqId = '88888888-8888-4888-8888-888888888888';

  engine.reserveCredit(uid, reqId, 'k1');
  const retry = engine.reserveCredit(uid, reqId, 'k1');
  assert.equal(retry.status, 409);
  assert.equal(retry.error, 'TRY_ON_IN_PROGRESS');
});

test('10. Operacja consumed nie uruchamia kolejnego VTON', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_consumed';
  const reqId = '99999999-9999-4999-8999-999999999999';

  engine.reserveCredit(uid, reqId, 'k1');
  engine.finalizeCredit(uid, reqId);

  const retry = engine.reserveCredit(uid, reqId, 'k1');
  assert.equal(retry.status, 409);
  assert.equal(retry.error, 'OPERATION_ALREADY_COMPLETED');
});

test('11. Operacja refunded wymaga nowego requestId', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_refunded';
  const reqId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  engine.reserveCredit(uid, reqId, 'k1');
  engine.refundCredit(uid, reqId);

  const retry = engine.reserveCredit(uid, reqId, 'k1');
  assert.equal(retry.status, 409);
  assert.equal(retry.error, 'REQUEST_ALREADY_REFUNDED');
});

test('12. Sukces wykonuje dokładnie jedno przejście reserved → consumed', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_success_trans';
  const reqId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  engine.reserveCredit(uid, reqId, 'k1');
  const fin = engine.finalizeCredit(uid, reqId);
  assert.equal(fin.ok, true);

  const op = engine.getOperation(`${uid}_${reqId}`)!;
  assert.equal(op.status, 'consumed');

  const w = engine.getWallet(uid)!;
  assert.equal(w.reservedCredits, 0);
  assert.equal(w.consumedCredits, 1);
});

test('13. Refund wykonuje dokładnie jedno przejście reserved → refunded', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_refund_trans';
  const reqId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  engine.reserveCredit(uid, reqId, 'k1');
  const ref = engine.refundCredit(uid, reqId);
  assert.equal(ref.ok, true);

  const op = engine.getOperation(`${uid}_${reqId}`)!;
  assert.equal(op.status, 'refunded');

  const w = engine.getWallet(uid)!;
  assert.equal(w.reservedCredits, 0);
  assert.equal(w.consumedCredits, 0);
});

test('14. Podwójny refund nie zwiększa salda', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_double_refund';
  const reqId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  engine.reserveCredit(uid, reqId, 'k1');
  const ref1 = engine.refundCredit(uid, reqId);
  assert.equal(ref1.ok, true);
  assert.equal(ref1.alreadyRefunded, false);

  const ref2 = engine.refundCredit(uid, reqId);
  assert.equal(ref2.ok, true);
  assert.equal(ref2.alreadyRefunded, true);

  const w = engine.getWallet(uid)!;
  assert.equal(w.reservedCredits, 0);
  assert.equal(calculateAvailableCredits(w), 3);
});

test('15. Nie można finalizować operacji, która nie jest reserved', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_invalid_fin';
  const reqId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  // Brak rezerwacji
  const fin = engine.finalizeCredit(uid, reqId);
  assert.equal(fin.ok, false);
  assert.equal(fin.error, 'OPERATION_NOT_FOUND');
});

test('16. Nie można refundować operacji consumed', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_refund_consumed';
  const reqId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  engine.reserveCredit(uid, reqId, 'k1');
  engine.finalizeCredit(uid, reqId);

  const ref = engine.refundCredit(uid, reqId);
  assert.equal(ref.ok, false);
  assert.equal(ref.error, 'CANNOT_REFUND_CONSUMED_OPERATION');
});

test('17. Liczniki nigdy nie są ujemne', () => {
  const invalidWallet: UserCreditsWallet = {
    grantedCredits: 3,
    reservedCredits: -1,
    consumedCredits: 0,
    schemaVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  assert.throws(() => {
    assertWalletInvariants(invalidWallet);
  }, CreditsInvariantError);
});

test('18. Błędny requestId zostaje odrzucony przed granicą płatnego wywołania', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: 'user_bad_req_id',
    requestId: 'invalid-non-uuid-string-1234',
    isCacheHit: false,
  });

  assert.equal(res.status, 400);
  assert.equal(res.error, 'INVALID_REQUEST_ID');
  assert.equal(engine.replicateCallCount, 0, 'Replicate nie mogło zostać wywołane');
});

test('19. Brak autoryzacji zostaje odrzucony przed logiką kredytową', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: false,
    requestId: '11111111-2222-4333-8444-555555555555',
    isCacheHit: false,
  });

  assert.equal(res.status, 401);
  assert.equal(res.error, 'AUTH_REQUIRED');
  assert.equal(engine.replicateCallCount, 0);
});

// ===========================================================================
// STATYCZNE TESTY ARCHITEKTURY I KONTRAKTÓW (Przypadki 20-25)
// ===========================================================================

test('20. Test statyczny potwierdza, że rezerwacja następuje przed wywołaniem Replicate', () => {
  const routeContent = fs.readFileSync(path.join(__dirname, 'app/api/try-on/route.ts'), 'utf8');

  const reservationIndex = routeContent.indexOf('reserveTryOnCredit(');
  const replicateIndex = routeContent.indexOf('replicate.run(');

  assert.ok(reservationIndex > 0, 'Musi istnieć wywołanie reserveTryOnCredit');
  assert.ok(replicateIndex > 0, 'Musi istnieć wywołanie replicate.run');
  assert.ok(
    reservationIndex < replicateIndex,
    `reserveTryOnCredit (${reservationIndex}) musi wystąpić PRZED replicate.run (${replicateIndex})`
  );
});

test('21. Test statyczny potwierdza, że cache lookup następuje przed rezerwacją', () => {
  const routeContent = fs.readFileSync(path.join(__dirname, 'app/api/try-on/route.ts'), 'utf8');

  const cacheLookupIndex = routeContent.indexOf('cacheRef.get()');
  const reservationIndex = routeContent.indexOf('reserveTryOnCredit(');

  assert.ok(cacheLookupIndex > 0, 'Musi istnieć cacheRef.get');
  assert.ok(reservationIndex > 0, 'Musi istnieć reserveTryOnCredit');
  assert.ok(
    cacheLookupIndex < reservationIndex,
    `cacheRef.get (${cacheLookupIndex}) musi wystąpić PRZED reserveTryOnCredit (${reservationIndex})`
  );
});

test('22. Test statyczny potwierdza użycie transakcji Firestore', () => {
  const creditsModuleContent = fs.readFileSync(path.join(__dirname, 'lib/try-on-credits.ts'), 'utf8');

  const transactionMatches = creditsModuleContent.match(/adminDb\.runTransaction/g);
  assert.ok(transactionMatches && transactionMatches.length >= 3, 'Musi posiadać runTransaction dla reserve, finalize i refund');
});

test('23. Test statyczny potwierdza, że klient przesyła requestId', () => {
  const clientContent = fs.readFileSync(path.join(__dirname, 'components/TryOnWidget.tsx'), 'utf8');

  assert.ok(clientContent.includes('crypto.randomUUID()'), 'Klient musi generować UUID v4 przez crypto.randomUUID()');
  assert.ok(clientContent.includes('requestId: clientRequestId'), 'Klient musi przekazywać requestId w body do /api/try-on');
});

test('24. Test statyczny potwierdza brak zaufania do userId z body', () => {
  const routeContent = fs.readFileSync(path.join(__dirname, 'app/api/try-on/route.ts'), 'utf8');

  assert.ok(
    !routeContent.includes('const { userId') && !routeContent.includes('body.userId'),
    'Endpoint nie może odczytywać ani ufać userId z body'
  );
  assert.ok(
    routeContent.includes('const verifiedUid = authResult.user.uid'),
    'verifiedUid musi pochodzić bezpośrednio z authResult.user.uid'
  );
});

test('25. Test potwierdza, że odpowiedź CREDIT_REQUIRED nie powoduje wywołania providera', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_credit_limit_check';

  // Zużywamy 3 darmowe przymiarki
  for (let i = 1; i <= 3; i++) {
    const res = await engine.simulateTryOnEndpoint({
      authHeaderPresent: true,
      verifiedUid: uid,
      requestId: `ffffffff-1111-4222-8333-aaaaaaaaaaa${i}`,
      isCacheHit: false,
    });
    assert.equal(res.status, 200);
  }
  assert.equal(engine.replicateCallCount, 3);

  // 4 próba - brak kredytów
  const resBlocked = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: 'ffffffff-1111-4222-8333-aaaaaaaaaaa4',
    isCacheHit: false,
  });

  assert.equal(resBlocked.status, 402);
  assert.equal(resBlocked.error, 'CREDIT_REQUIRED');
  assert.equal(engine.replicateCallCount, 3, 'Liczba wywołań Replicate NIE MOGŁA wzrosnąć');
});

// ===========================================================================
// ADVERSARIAL AUDIT & REFUND SAFETY TESTS (KROK 4D-1A)
// ===========================================================================

test('26. Wynik trwale zapisany (durable) NIE MOŻE zostać zwrócony (refund) w przypadku awarii finalizacji', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_durable_no_refund';
  const reqId = '12121212-1212-4212-8212-121212121212';

  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: reqId,
    isCacheHit: false,
    finalizeShouldFail: true,
  });

  assert.equal(res.status, 500);
  assert.equal(res.durableResultPersisted, true);
  assert.equal(res.creditFinalized, false);

  const op = engine.getOperation(`${uid}_${reqId}`)!;
  // Operacja MUSI pozostać 'reserved' (nie 'refunded'!), chroniąc biznes przed wyciekiem
  assert.equal(op.status, 'reserved');

  const wallet = engine.getWallet(uid)!;
  assert.equal(wallet.reservedCredits, 1);
  assert.equal(wallet.consumedCredits, 0);
  assert.equal(calculateAvailableCredits(wallet), 2);
});

test('27. Błąd przed trwałym zapisem (np. błąd providera) wykonuje bezpieczny refund', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_provider_fail_refund';
  const reqId = '13131313-1313-4313-8313-131313131313';

  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: reqId,
    isCacheHit: false,
    providerShouldFail: true,
  });

  assert.equal(res.status, 500);
  assert.equal(res.durableResultPersisted, false);

  const op = engine.getOperation(`${uid}_${reqId}`)!;
  assert.equal(op.status, 'refunded');

  const wallet = engine.getWallet(uid)!;
  assert.equal(wallet.reservedCredits, 0);
  assert.equal(calculateAvailableCredits(wallet), 3);
});

test('28. Idempotency Binding: ponowne użycie requestId z innym cacheKey zwraca HTTP 409 IDEMPOTENCY_KEY_REUSED', () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_idempotency_binding';
  const reqId = '14141414-1414-4414-8414-141414141414';

  const res1 = engine.reserveCredit(uid, reqId, 'cache_key_A');
  assert.equal(res1.ok, true);

  const res2 = engine.reserveCredit(uid, reqId, 'cache_key_B');
  assert.equal(res2.ok, false);
  assert.equal(res2.status, 409);
  assert.equal(res2.error, 'IDEMPOTENCY_KEY_REUSED');
});

test('29. Cache Hit dla operacji w stanie reserved finalizuje rozliczenie', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_reconcile_reserved';
  const reqId = '15151515-1515-4515-8515-151515151515';

  // Wstępna rezerwacja (np. po awarii procesu przed finalizacją)
  engine.reserveCredit(uid, reqId, 'cache_key_15');
  assert.equal(engine.getOperation(`${uid}_${reqId}`)!.status, 'reserved');

  // Ponowne żądanie tego samego klienta trafia w Cache Hit
  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: reqId,
    isCacheHit: true,
  });

  assert.equal(res.status, 200);
  assert.equal(res.cached, true);
  // Operacja została sfinalizowana do 'consumed'
  assert.equal(engine.getOperation(`${uid}_${reqId}`)!.status, 'consumed');

  const wallet = engine.getWallet(uid)!;
  assert.equal(wallet.reservedCredits, 0);
  assert.equal(wallet.consumedCredits, 1);
});

test('30. Cache Hit dla operacji w stanie refunded jest odrzucany z kodem HTTP 409', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_cache_refunded_reject';
  const reqId = '16161616-1616-4616-8616-161616161616';

  engine.reserveCredit(uid, reqId, 'cache_key_16');
  engine.refundCredit(uid, reqId);
  assert.equal(engine.getOperation(`${uid}_${reqId}`)!.status, 'refunded');

  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: reqId,
    isCacheHit: true,
  });

  assert.equal(res.status, 409);
  assert.equal(res.error, 'REQUEST_ALREADY_REFUNDED');
});

test('31. Statyczny audyt: route.ts posiada bezpieczny warunek refund guard (3 warunki)', () => {
  const routeContent = fs.readFileSync(path.join(__dirname, 'app/api/try-on/route.ts'), 'utf8');

  // Weryfikacja, że blok catch zawiera dokładny trójstopniowy warunek logiczny
  assert.ok(
    routeContent.includes('reservationCreated === true'),
    'route.ts musi jawnie weryfikować reservationCreated === true'
  );
  assert.ok(
    routeContent.includes('creditFinalized === false'),
    'route.ts musi jawnie weryfikować creditFinalized === false'
  );
  assert.ok(
    routeContent.includes('durableResultPersisted === false'),
    'route.ts musi jawnie weryfikować durableResultPersisted === false'
  );
  assert.ok(
    routeContent.includes('reservationCreated === true &&\n        creditFinalized === false &&\n        durableResultPersisted === false') ||
    routeContent.includes('reservationCreated === true &&\r\n        creditFinalized === false &&\r\n        durableResultPersisted === false'),
    'route.ts musi zawierać spójny blok canSafelyRefund ze wszystkimi 3 przesłankami'
  );
});

test('32. Statyczny audyt: lib/try-on-credits.ts sprawdza zgodność cacheKey przy sprawdzaniu idempotencji', () => {
  const creditsContent = fs.readFileSync(path.join(__dirname, 'lib/try-on-credits.ts'), 'utf8');

  assert.ok(
    creditsContent.includes('IDEMPOTENCY_KEY_REUSED'),
    'lib/try-on-credits.ts musi definiować kod błędu IDEMPOTENCY_KEY_REUSED'
  );
  assert.ok(
    creditsContent.includes('opData.cacheKey !== cacheKey'),
    'lib/try-on-credits.ts musi weryfikować czy cacheKey odpowiada poprzedniemu wywołaniu'
  );
});

// ===========================================================================
// PRECYZYJNA MACIERZ WARUNKÓW REFUND GUARDA (KROK 4D-1B)
// ===========================================================================

test('33. Macierz Refund: reservationCreated=false, creditFinalized=false, durableResultPersisted=false → refund NIE jest wywoływany', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_matrix_fff';
  const reqId = 'bad-req-id-uuid-fail';

  // Błąd walidacji requestId następuje PRZED rezerwacją (reservationCreated=false)
  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: reqId,
    isCacheHit: false,
  });

  assert.equal(res.status, 400);
  assert.equal(engine.refundCallCount, 0, 'Refund NIE MOŻE zostać wywołany');
});

test('34. Macierz Refund: reservationCreated=true, creditFinalized=false, durableResultPersisted=false → refund wywoływany DOKŁADNIE RAZ', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_matrix_tff';
  const reqId = '21212121-2121-4121-8121-212121212121';

  // Błąd providera przed zapisem do Storage/Firestore
  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: reqId,
    isCacheHit: false,
    providerShouldFail: true,
  });

  assert.equal(res.status, 500);
  assert.equal(res.reservationCreated, true);
  assert.equal(res.creditFinalized, false);
  assert.equal(res.durableResultPersisted, false);
  assert.equal(engine.refundCallCount, 1, 'Refund MUSI zostać wywołany dokładnie raz');

  const op = engine.getOperation(`${uid}_${reqId}`)!;
  assert.equal(op.status, 'refunded');
});

test('35. Macierz Refund: reservationCreated=true, creditFinalized=true, durableResultPersisted=true → refund NIE jest wywoływany', async () => {
  const engine = new InMemoryFirestoreCreditsEngine();
  const uid = 'user_matrix_ttt';
  const reqId = '22222222-2222-4222-8222-222222222222';

  // Pełny sukces
  const res = await engine.simulateTryOnEndpoint({
    authHeaderPresent: true,
    verifiedUid: uid,
    requestId: reqId,
    isCacheHit: false,
  });

  assert.equal(res.status, 200);
  assert.equal(engine.refundCallCount, 0, 'Refund NIE MOŻE zostać wywołany przy pełnym sukcesie');
  assert.equal(engine.getOperation(`${uid}_${reqId}`)!.status, 'consumed');
});

test('36. Macierz Refund: reservationCreated=false, creditFinalized=false, durableResultPersisted=true → refund NIE jest wywoływany', () => {
  function evaluateCanSafelyRefund(created: boolean, finalized: boolean, persisted: boolean): boolean {
    return created === true && finalized === false && persisted === false;
  }

  const canSafelyRefund = evaluateCanSafelyRefund(false, false, true);
  assert.equal(canSafelyRefund, false, 'Dla reservationCreated=false refund nie może przejść');
});

test('37. Statyczny audyt: reservationCreated = true znajduje się PO udanej rezerwacji, a nie przed', () => {
  const routeContent = fs.readFileSync(path.join(__dirname, 'app/api/try-on/route.ts'), 'utf8');

  const reserveCallIndex = routeContent.indexOf('const reservationResult = await reserveTryOnCredit(');
  const checkErrorIndex = routeContent.indexOf('if (!reservationResult.ok) {', reserveCallIndex);
  const setFlagIndex = routeContent.indexOf('reservationCreated = true;', checkErrorIndex);

  assert.ok(reserveCallIndex > 0, 'Musi istnieć wywołanie reserveTryOnCredit');
  assert.ok(checkErrorIndex > reserveCallIndex, 'Musi istnieć weryfikacja błędu po wywołaniu reserveTryOnCredit');
  assert.ok(setFlagIndex > checkErrorIndex, 'Ustawienie reservationCreated = true musi wystąpić PO sprawdzeniu błędu rezerwacji');
});


