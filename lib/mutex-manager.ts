import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

export interface MutexSessionData {
  uid: string;
  sessionId: string;
  status: 'processing';
  startedAt: number;
  expiresAt: number;
}

export interface AcquireMutexResult {
  acquired: boolean;
  sessionId?: string;
  activeSession?: MutexSessionData;
}

export const MUTEX_TTL_MS = 3 * 60 * 1000; // 3 minuty TTL

/**
 * Transakcyjnie przejmuje per-user mutex z unikalnym sessionId.
 */
export async function acquireUserMutex(
  adminDb: Firestore,
  uid: string,
  ttlMs = MUTEX_TTL_MS
): Promise<AcquireMutexResult> {
  const sessionRef = adminDb.collection('active_sessions').doc(uid);
  const now = Date.now();
  const newSessionId = crypto.randomUUID();

  return await adminDb.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(sessionRef);

    if (docSnap.exists) {
      const data = docSnap.data() as Partial<MutexSessionData>;
      if (data?.status === 'processing') {
        const expiresAt = data?.expiresAt ?? (data?.startedAt ? data.startedAt + ttlMs : 0);
        // Jeśli blokada jest wciąż ważna (czas nie upłynął)
        if (now < expiresAt) {
          return {
            acquired: false,
            activeSession: data as MutexSessionData,
          };
        }
      }
    }

    const sessionPayload: MutexSessionData = {
      uid,
      sessionId: newSessionId,
      status: 'processing',
      startedAt: now,
      expiresAt: now + ttlMs,
    };

    transaction.set(sessionRef, sessionPayload);
    return {
      acquired: true,
      sessionId: newSessionId,
    };
  });
}

/**
 * Transakcyjnie zwalnia mutex pod warunkiem zgodności sessionId.
 * Zapobiega sytuacji, w której stara sesja czyści blokadę nowszej sesji (np. po opóźnieniu).
 */
export async function releaseUserMutex(
  adminDb: Firestore,
  uid: string,
  sessionId: string
): Promise<boolean> {
  const sessionRef = adminDb.collection('active_sessions').doc(uid);

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(sessionRef);
      if (!docSnap.exists) {
        return false;
      }

      const data = docSnap.data() as Partial<MutexSessionData>;
      // Kluczowy warunek: usuń WYŁĄCZNIE wtedy, gdy dokument należy do TEJ KONKRETNEJ sesji
      if (data?.sessionId === sessionId) {
        transaction.delete(sessionRef);
        return true;
      }

      // Jeśli w międzyczasie inna sesja przejęła mutex, nie usuwamy go
      return false;
    });
  } catch (err) {
    console.warn('[MUTEX] Błąd podczas bezpiecznego zwalniania mutexu:', err);
    return false;
  }
}
