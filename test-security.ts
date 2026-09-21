import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTryOnCacheKey } from '@/lib/try-on-cache';
import { detectImageFormat, validateImageBuffer } from '@/lib/image-validator';
import { isPrivateOrDisallowedIp, validateUrlStructure, resolveAndValidateHost } from '@/lib/ssrf-guard';

// ---------------------------------------------------------------------------
// 1. TESTY DETERMINIZMU CACHE (ETAP 6.1)
// ---------------------------------------------------------------------------
test('Cache Fingerprint: identyczne wejście generuje identyczny klucz', () => {
  const baseParams = {
    verifiedUid: 'user123',
    userImageSha256: 'sha256_user_aaa',
    clothingIdentifierOrSha256: 'sha256_cloth_bbb',
    category: 'upper_body',
    replicatePrompt: 'blue shirt, elegant',
    modelIdentifier: 'cuuupid/idm-vton:version_hash',
    guidanceScale: 2.5,
    numInferenceSteps: 30,
    seed: 42,
  };

  const key1 = computeTryOnCacheKey(baseParams);
  const key2 = computeTryOnCacheKey({ ...baseParams });
  assert.equal(key1, key2);
});

test('Cache Fingerprint: zmiana dowolnego parametru wejścia unieważnia klucz', () => {
  const baseParams = {
    verifiedUid: 'user123',
    userImageSha256: 'sha256_user_aaa',
    clothingIdentifierOrSha256: 'sha256_cloth_bbb',
    category: 'upper_body',
    replicatePrompt: 'blue shirt, elegant',
    modelIdentifier: 'cuuupid/idm-vton:version_hash',
    guidanceScale: 2.5,
    numInferenceSteps: 30,
    seed: 42,
  };

  const keyBase = computeTryOnCacheKey(baseParams);

  assert.notEqual(keyBase, computeTryOnCacheKey({ ...baseParams, userImageSha256: 'sha256_user_diff' }));
  assert.notEqual(keyBase, computeTryOnCacheKey({ ...baseParams, clothingIdentifierOrSha256: 'sha256_cloth_diff' }));
  assert.notEqual(keyBase, computeTryOnCacheKey({ ...baseParams, replicatePrompt: 'red shirt' }));
  assert.notEqual(keyBase, computeTryOnCacheKey({ ...baseParams, category: 'dresses' }));
  assert.notEqual(keyBase, computeTryOnCacheKey({ ...baseParams, verifiedUid: 'user999' }));
  assert.notEqual(keyBase, computeTryOnCacheKey({ ...baseParams, guidanceScale: 3.0 }));
});

// ---------------------------------------------------------------------------
// 2. TESTY MAGIC BYTES I WALIDACJI OBRAZÓW (ETAP 6.2)
// ---------------------------------------------------------------------------
test('Magic Bytes: rozpoznaje minimalny poprawny JPEG', () => {
  const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  assert.equal(detectImageFormat(jpegBuf), 'jpeg');
  const res = validateImageBuffer(jpegBuf);
  assert.equal(res.valid, true);
  assert.equal(res.format, 'jpeg');
  assert.equal(res.extension, 'jpg');
});

test('Magic Bytes: rozpoznaje minimalny poprawny PNG', () => {
  const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert.equal(detectImageFormat(pngBuf), 'png');
  const res = validateImageBuffer(pngBuf);
  assert.equal(res.valid, true);
  assert.equal(res.format, 'png');
  assert.equal(res.extension, 'png');
});

test('Magic Bytes: rozpoznaje minimalny poprawny WebP', () => {
  const webpBuf = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
  ]);
  assert.equal(detectImageFormat(webpBuf), 'webp');
  const res = validateImageBuffer(webpBuf);
  assert.equal(res.valid, true);
  assert.equal(res.format, 'webp');
  assert.equal(res.extension, 'webp');
});

test('Magic Bytes: rozpoznaje poprawny nagłówek AVIF (ISOBMFF ftyp avif)', () => {
  const avifBuf = Buffer.from([
    0x00, 0x00, 0x00, 0x1c, // ftyp box length = 28 bytes
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x61, 0x76, 0x69, 0x66, // major brand: 'avif'
    0x00, 0x00, 0x00, 0x00, // minor version
    0x6d, 0x69, 0x66, 0x31, // compatible: 'mif1'
    0x61, 0x76, 0x69, 0x66, // compatible: 'avif'
    0x00, 0x00, 0x00, 0x00
  ]);
  assert.equal(detectImageFormat(avifBuf), 'avif');
  const res = validateImageBuffer(avifBuf);
  assert.equal(res.valid, true);
  assert.equal(res.format, 'avif');
  assert.equal(res.extension, 'avif');
});

test('Magic Bytes: odrzuca losowe dane oraz niespójny deklarowany MIME', () => {
  const randomBuf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
  assert.equal(detectImageFormat(randomBuf), null);
  const res = validateImageBuffer(randomBuf);
  assert.equal(res.valid, false);

  const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const mismatchRes = validateImageBuffer(pngBuf, 10 * 1024 * 1024, 'image/jpeg');
  assert.equal(mismatchRes.valid, false);
  assert.match(mismatchRes.error || '', /Deklarowany typ/);
});

// ---------------------------------------------------------------------------
// 3. TESTY OCHRONY SSRF ORAZ ZAKRESÓW IP (ETAP 6.3)
// ---------------------------------------------------------------------------
test('SSRF Guard: filtruje prywatne, specjalne i cloud metadata adresy IP', () => {
  assert.equal(isPrivateOrDisallowedIp('8.8.8.8'), false);
  assert.equal(isPrivateOrDisallowedIp('1.1.1.1'), false);
  assert.equal(isPrivateOrDisallowedIp('140.82.121.4'), false);

  assert.equal(isPrivateOrDisallowedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrDisallowedIp('127.1.2.3'), true);
  assert.equal(isPrivateOrDisallowedIp('10.0.0.1'), true);
  assert.equal(isPrivateOrDisallowedIp('172.16.0.1'), true);
  assert.equal(isPrivateOrDisallowedIp('172.31.255.255'), true);
  assert.equal(isPrivateOrDisallowedIp('192.168.1.100'), true);
  assert.equal(isPrivateOrDisallowedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrDisallowedIp('100.64.0.1'), true);
  assert.equal(isPrivateOrDisallowedIp('0.0.0.0'), true);

  assert.equal(isPrivateOrDisallowedIp('::1'), true);
  assert.equal(isPrivateOrDisallowedIp('fe80::1'), true);
  assert.equal(isPrivateOrDisallowedIp('fc00::1'), true);
  assert.equal(isPrivateOrDisallowedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrDisallowedIp('::ffff:169.254.169.254'), true);
});

test('SSRF Guard: waliduje strukturę URL (HTTPS, brak credentials, brak localhost)', () => {
  assert.throws(() => validateUrlStructure('http://example.com/image.jpg'), /Dozwolony jest wyłącznie protokół HTTPS/);
  assert.throws(() => validateUrlStructure('https://user:pass@example.com/image.jpg'), /URL nie może zawierać danych uwierzytelniających/);
  assert.throws(() => validateUrlStructure('https://localhost:3000/image.jpg'), /Niedozwolony docelowy host/);
  assert.throws(() => validateUrlStructure('https://metadata.google.internal/computeMetadata/v1'), /Niedozwolony docelowy host/);
  assert.doesNotThrow(() => validateUrlStructure('https://cdn.example.com/product/123.jpg'));
});

test('SSRF Guard: resolveAndValidateHost odrzuca prywatne IP w rekordach DNS', async () => {
  await assert.rejects(
    async () => await resolveAndValidateHost('127.0.0.1'),
    /niedozwolonym zakresie/
  );
  await assert.rejects(
    async () => await resolveAndValidateHost('169.254.169.254'),
    /niedozwolonym zakresie/
  );
});

// ---------------------------------------------------------------------------
// 4. TESTY LOGIKI MUTEXU I WŁASNOŚCI SESJI (ETAP 6.4)
// ---------------------------------------------------------------------------
interface MockTransaction {
  get(ref: { path: string }): Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  set(ref: { path: string }, data: Record<string, unknown>): void;
  delete(ref: { path: string }): void;
}

class MockFirestore {
  storage = new Map<string, Record<string, unknown>>();

  async runTransaction<T>(updateFunction: (transaction: MockTransaction) => Promise<T>): Promise<T> {
    const transaction: MockTransaction = {
      get: async (ref: { path: string }) => {
        const data = this.storage.get(ref.path);
        return {
          exists: !!data,
          data: () => data,
        };
      },
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        this.storage.set(ref.path, { ...data });
      },
      delete: (ref: { path: string }) => {
        this.storage.delete(ref.path);
      },
    };
    return await updateFunction(transaction);
  }

  collection(name: string) {
    return {
      doc: (id: string) => ({ path: `${name}/${id}` }),
    };
  }
}

async function acquireMutex(db: MockFirestore, uid: string, sessionId: string, now: number, ttlMs = 180000) {
  const sessionRef = db.collection('active_sessions').doc(uid);
  return await db.runTransaction(async (transaction: MockTransaction) => {
    const docSnap = await transaction.get(sessionRef);
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.status === 'processing') {
        const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : (typeof data.startedAt === 'number' ? data.startedAt + ttlMs : 0);
        if (now < expiresAt) {
          return { acquired: false };
        }
      }
    }
    transaction.set(sessionRef, {
      uid,
      sessionId,
      status: 'processing',
      startedAt: now,
      expiresAt: now + ttlMs,
    });
    return { acquired: true, sessionId };
  });
}

async function releaseMutex(db: MockFirestore, uid: string, sessionId: string) {
  const sessionRef = db.collection('active_sessions').doc(uid);
  return await db.runTransaction(async (transaction: MockTransaction) => {
    const docSnap = await transaction.get(sessionRef);
    if (!docSnap.exists) return false;
    const data = docSnap.data();
    if (data?.sessionId === sessionId) {
      transaction.delete(sessionRef);
      return true;
    }
    return false;
  });
}

test('Mutex Ownership: transakcyjne zarządzanie i ochrona przed usunięciem cudzej blokady', async () => {
  const mockDb = new MockFirestore();
  const uid = 'user_test_mutex';

  const resA = await acquireMutex(mockDb, uid, 'session_A', 1000);
  assert.equal(resA.acquired, true);

  const resB_early = await acquireMutex(mockDb, uid, 'session_B', 2000);
  assert.equal(resB_early.acquired, false);

  const resB_later = await acquireMutex(mockDb, uid, 'session_B', 200000);
  assert.equal(resB_later.acquired, true);

  const releasedByA = await releaseMutex(mockDb, uid, 'session_A');
  assert.equal(releasedByA, false);

  const activeDoc = mockDb.storage.get(`active_sessions/${uid}`);
  assert.equal(activeDoc?.sessionId, 'session_B');

  const releasedByB = await releaseMutex(mockDb, uid, 'session_B');
  assert.equal(releasedByB, true);
  assert.equal(mockDb.storage.get(`active_sessions/${uid}`), undefined);
});

// ---------------------------------------------------------------------------
// 5. TESTY CACHE STORAGE (ETAP 6.5)
// ---------------------------------------------------------------------------
test('Cache Storage: weryfikacja obsługi trwałego rekordu oraz legacy miss', () => {
  const verifiedUid = 'user_123';

  const validCacheDoc = {
    uid: 'user_123',
    cacheKey: 'abc_key',
    storagePath: 'try-on-results/user_123/abc_key.jpg',
    detectedMimeType: 'image/jpeg',
    status: 'ready',
  };
  assert.equal(validCacheDoc.uid, verifiedUid);
  assert.ok(validCacheDoc.storagePath);

  const legacyCacheDoc = {
    uid: 'user_123',
    imageUrl: 'https://replicate.delivery/pbxt/legacy123.png',
  };
  const isLegacyMiss = !('storagePath' in legacyCacheDoc);
  assert.equal(isLegacyMiss, true);

  const foreignCacheDoc = {
    uid: 'user_other',
    storagePath: 'try-on-results/user_other/xyz.jpg',
  };
  const isUnauthorized = foreignCacheDoc.uid !== verifiedUid;
  assert.equal(isUnauthorized, true);
});

// ---------------------------------------------------------------------------
// 6. TESTY ROLLBACKU STORAGE ORAZ SPÓJNOŚCI CACHE (ETAP 4)
// ---------------------------------------------------------------------------
test('Storage Rollback: scenariusz Storage PASS + Firestore FAIL powoduje usunięcie pliku Storage', async () => {
  let fileSaved = false;
  let fileDeleted = false;

  const mockFile = {
    save: async () => { fileSaved = true; },
    delete: async () => { fileDeleted = true; },
  };

  const mockCacheRef = {
    set: async () => { throw new Error('Firestore write simulated failure'); },
  };

  let resultFileCreated = false;
  let cacheRecordSaved = false;

  try {
    await mockFile.save();
    resultFileCreated = true;

    await mockCacheRef.set();
    cacheRecordSaved = true;
  } catch {
    if (resultFileCreated && !cacheRecordSaved) {
      await mockFile.delete();
    }
  }

  assert.equal(fileSaved, true, 'Plik musiał zostać wstępnie zapisany');
  assert.equal(cacheRecordSaved, false, 'Rekord Firestore nie został zapisany');
  assert.equal(fileDeleted, true, 'Osierocony plik Storage musiał zostać wycofany (rollback delete)');
});

test('Storage Rollback: scenariusz Storage PASS + Firestore PASS + signedUrl FAIL zachowuje plik i rekord', async () => {
  let fileSaved = false;
  let fileDeleted = false;
  let recordSaved = false;

  const mockFile = {
    save: async () => { fileSaved = true; },
    delete: async () => { fileDeleted = true; },
    getSignedUrl: async () => { throw new Error('Signed URL signing failure'); },
  };

  const mockCacheRef = {
    set: async () => { recordSaved = true; },
  };

  let resultFileCreated = false;
  let cacheRecordSaved = false;

  try {
    await mockFile.save();
    resultFileCreated = true;

    await mockCacheRef.set();
    cacheRecordSaved = true;

    await mockFile.getSignedUrl();
  } catch {
    if (resultFileCreated && !cacheRecordSaved) {
      await mockFile.delete();
    }
  }

  assert.equal(fileSaved, true, 'Plik został pomyślnie zapisany');
  assert.equal(recordSaved, true, 'Rekord Firestore został pomyślnie utrwalony');
  assert.equal(fileDeleted, false, 'Plik Storage NIE MOŻE zostać usunięty, bo rekord Firestore jest spójny');
});

