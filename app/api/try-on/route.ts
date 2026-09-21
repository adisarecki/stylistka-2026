import Replicate from "replicate";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAuthenticatedUser } from "@/lib/auth-server";
import { getAdminFirestore, getAdminBucket } from "@/lib/firebase-admin";
import { safeFetchExternalImage, SsrffValidationError } from "@/lib/ssrf-guard";
import { computeTryOnCacheKey } from "@/lib/try-on-cache";
import { acquireUserMutex, releaseUserMutex } from "@/lib/mutex-manager";
import { validateImageBuffer } from "@/lib/image-validator";
import {
  isValidRequestId,
  reserveTryOnCredit,
  finalizeTryOnCredit,
  refundTryOnCredit,
} from "@/lib/try-on-credits";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Wersja IDM-VTON (stabilna, marzec 2026)
const IDM_VTON_MODEL = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

// Stałe parametry modelu dla powtarzalności i cache
const MODEL_GUIDANCE_SCALE = 2.5;
const MODEL_INFERENCE_STEPS = 30;
const MODEL_SEED = 42;

// Limity wejściowe
const MAX_USER_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_BASE64_STRING_LENGTH = 15 * 1024 * 1024;
const MAX_PRODUCT_TITLE_LENGTH = 300;
const MAX_PROMPT_LENGTH = 1000;
const ALLOWED_CATEGORIES = new Set(['upper_body', 'lower_body', 'dresses']);

function extractErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }

  const record = err as Record<string, unknown>;

  if (typeof record.status === 'number') {
    return record.status;
  }

  if (typeof record.response === 'object' && record.response !== null) {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.status === 'number') {
      return responseRecord.status;
    }
  }

  return undefined;
}

function isRateLimitError(err: unknown): boolean {
  const status = extractErrorStatus(err);
  if (status === 429) {
    return true;
  }

  if (typeof err === 'object' && err !== null) {
    const record = err as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.includes('429')) {
      return true;
    }
  }

  return false;
}

export async function POST(req: Request) {
  // === KROK 0: AUTORYZACJA SERWEROWA ===
  const authResult = await requireAuthenticatedUser(req);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        error: authResult.code,
        message: authResult.message,
      },
      {
        status: authResult.status,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const verifiedUid = authResult.user.uid;
  let userStoragePath: string | null = null;
  let proxyStoragePath: string | null = null;
  let currentSessionId: string | null = null;
  let activeRequestId: string | null = null;
  let reservationCreated = false;
  let durableResultPersisted = false;
  let creditFinalized = false;

  const adminDb = getAdminFirestore();
  const bucket = getAdminBucket();

  try {
    const body = await req.json();
    const { personImage, clothingImage, category, productTitle, replicatePrompt, requestId } = body;

    // === KROK 1: WALIDACJA LIMITÓW ORAZ PARAMETRÓW WEJŚCIA ===
    if (!requestId || !isValidRequestId(requestId)) {
      return NextResponse.json(
        {
          error: 'INVALID_REQUEST_ID',
          message: 'Wymagany jest unikalny identyfikator żądania (requestId w formacie UUID v4).',
        },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }
    activeRequestId = requestId;

    if (!personImage || typeof personImage !== 'string') {
      return NextResponse.json(
        { error: 'Brak zdjęcia sylwetki użytkownika.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (personImage.length > MAX_BASE64_STRING_LENGTH) {
      return NextResponse.json(
        { error: 'Ciąg Data URL zdjęcia przekracza dopuszczalny limit pamięci.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const dataUrlMatch = personImage.match(/^data:(image\/(jpeg|png|webp|avif));base64,/i);
    if (!dataUrlMatch) {
      return NextResponse.json(
        { error: 'Zdjęcie użytkownika musi być w formacie JPEG, PNG, WebP lub AVIF (Data URL base64).' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const declaredMime = dataUrlMatch[1];
    const base64Data = personImage.substring(dataUrlMatch[0].length);
    const userImageBuffer = Buffer.from(base64Data, 'base64');

    const userImageValidation = validateImageBuffer(userImageBuffer, MAX_USER_IMAGE_BYTES, declaredMime);
    if (!userImageValidation.valid || !userImageValidation.format || !userImageValidation.extension) {
      return NextResponse.json(
        { error: userImageValidation.error || 'Uszkodzone lub nieobsługiwane zdjęcie użytkownika.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!clothingImage || typeof clothingImage !== 'string' || !clothingImage.trim()) {
      return NextResponse.json(
        { error: 'Brak wymaganego zdjęcia odzieży.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (category && typeof category === 'string' && !ALLOWED_CATEGORIES.has(category.trim())) {
      return NextResponse.json(
        { error: 'Nieprawidłowa kategoria odzieży. Dozwolone: upper_body, lower_body, dresses.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const safeTitle = (typeof productTitle === 'string' ? productTitle.slice(0, MAX_PRODUCT_TITLE_LENGTH) : '').trim();
    const safePrompt = (typeof replicatePrompt === 'string' ? replicatePrompt.slice(0, MAX_PROMPT_LENGTH) : '').trim();

    const userImageSha256 = crypto.createHash('sha256').update(userImageBuffer).digest('hex');

    // === KROK 2: PER-USER MUTEX Z WŁASNOŚCIĄ SESJI ===
    const mutexRes = await acquireUserMutex(adminDb, verifiedUid);
    if (!mutexRes.acquired || !mutexRes.sessionId) {
      return NextResponse.json(
        {
          error: "Wirtualna Stylistka jest zajęta inną przymiarką. Poczekaj chwilę.",
          mutexLocked: true,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    currentSessionId = mutexRes.sessionId;

    // === KROK 3: BEZPIECZNE POBRANIE ODZIEŻY (SSRF GUARD) ===
    let garm_img = clothingImage;
    let clothingIdentifierOrSha = clothingImage;

    if (clothingImage.startsWith('https://')) {
      try {
        const fetchedImage = await safeFetchExternalImage(clothingImage);
        clothingIdentifierOrSha = crypto.createHash('sha256').update(fetchedImage.buffer).digest('hex');

        const fileId = `garm_proxy_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${fetchedImage.extension}`;
        proxyStoragePath = `proxied/${fileId}`;

        const proxyFile = bucket.file(proxyStoragePath);
        await proxyFile.save(fetchedImage.buffer, {
          contentType: fetchedImage.contentType,
          resumable: false,
        });

        const [proxySignedUrl] = await proxyFile.getSignedUrl({
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });
        garm_img = proxySignedUrl;
      } catch (err: unknown) {
        if (err instanceof SsrffValidationError) {
          return NextResponse.json(
            { error: `Błąd weryfikacji obrazu odzieży: ${err.message}` },
            { status: 422, headers: { 'Cache-Control': 'no-store' } }
          );
        }
        return NextResponse.json(
          { error: "Nie udało się pobrać bezpiecznego zdjęcia odzieży." },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    } else if (clothingImage.startsWith('http://')) {
      return NextResponse.json(
        { error: 'Protokół HTTP nie jest dozwolony dla bezpieczeństwa. Wymagany jest HTTPS.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let finalCategory = category || 'upper_body';
    let finalForceDc = finalCategory === 'dresses';
    let finalGarmentDes = safePrompt || safeTitle || 'photorealistic clothing, highly detailed';

    const lowerDesc = finalGarmentDes.toLowerCase() + " " + safeTitle.toLowerCase();
    if (lowerDesc.includes('sukienk') || lowerDesc.includes('suknia') || lowerDesc.includes('maxi') || lowerDesc.includes('balow')) {
      finalCategory = "dresses";
      finalForceDc = true;

      if (!lowerDesc.includes('dress')) {
        finalGarmentDes += ", long elegant dress, full length maxi dress, covering legs entirely down to the floor, highly detailed";
      }
    }

    // === KROK 4: DETERMINISTYCZNY CACHE LOOKUP ===
    const cacheKey = computeTryOnCacheKey({
      verifiedUid,
      userImageSha256,
      clothingIdentifierOrSha256: clothingIdentifierOrSha,
      category: finalCategory,
      replicatePrompt: finalGarmentDes,
      modelIdentifier: IDM_VTON_MODEL,
      guidanceScale: MODEL_GUIDANCE_SCALE,
      numInferenceSteps: MODEL_INFERENCE_STEPS,
      seed: MODEL_SEED,
    });

    const cacheRef = adminDb.collection('try_on_results').doc(cacheKey);

    try {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        if (cacheData?.uid === verifiedUid) {
          if (cacheData.storagePath && typeof cacheData.storagePath === 'string') {
            const cachedFile = bucket.file(cacheData.storagePath);
            const [exists] = await cachedFile.exists();
            if (exists) {
              // Rekonsyliacja / weryfikacja statusu operacji dla tego żądania (jeśli istnieje)
              const opDoc = await adminDb.collection('try_on_operations').doc(`${verifiedUid}_${activeRequestId}`).get();
              if (opDoc.exists) {
                const op = opDoc.data();
                if (op?.status === 'refunded') {
                  return NextResponse.json(
                    {
                      error: 'REQUEST_ALREADY_REFUNDED',
                      message: 'To żądanie przymiarki zostało już wycofane i nie może zostać zrealizowane.',
                    },
                    { status: 409, headers: { 'Cache-Control': 'no-store' } }
                  );
                }
                if (op?.status === 'reserved') {
                  const finRes = await finalizeTryOnCredit(adminDb, verifiedUid, activeRequestId);
                  if (!finRes.ok) {
                    return NextResponse.json(
                      {
                        error: 'CREDITS_SYSTEM_ERROR',
                        message: 'Nie udało się sfinalizować rozliczenia kredytu dla istniejącego wyniku.',
                      },
                      { status: 500, headers: { 'Cache-Control': 'no-store' } }
                    );
                  }
                }
              }

              const [freshSignedUrl] = await cachedFile.getSignedUrl({
                action: 'read',
                expires: Date.now() + 15 * 60 * 1000,
              });
              // CACHE HIT: Kredyt NIE jest pobierany dla nowych żądań
              return NextResponse.json(
                { imageUrl: freshSignedUrl, cached: true },
                { headers: { 'Cache-Control': 'no-store' } }
              );
            } else {
              await cacheRef.delete().catch(() => { });
            }
          }
        }
      }
    } catch (cacheErr: unknown) {
      if (cacheErr instanceof Response || (typeof cacheErr === 'object' && cacheErr !== null && 'status' in cacheErr && (cacheErr as Record<string, unknown>).status === 409)) {
        throw cacheErr;
      }
      console.warn('[TRY-ON] Cache read error:', cacheErr);
    }

    // === KROK 4.5: ATOMOWA REZERWACJA KREDYTU I SPRAWDZENIE IDEMPOTENCJI ===
    // Wykonywane WYŁĄCZNIE po upewnieniu się, że nastąpił CACHE MISS, a PRZED jakimkolwiek płatnym wywołaniem
    const reservationResult = await reserveTryOnCredit(adminDb, verifiedUid, activeRequestId, cacheKey);
    if (!reservationResult.ok) {
      if (reservationResult.error === 'CREDIT_REQUIRED') {
        return NextResponse.json(
          {
            error: 'CREDIT_REQUIRED',
            message: reservationResult.message,
            credits: { available: reservationResult.available },
          },
          {
            status: reservationResult.status,
            headers: { 'Cache-Control': 'no-store' },
          }
        );
      }

      return NextResponse.json(
        {
          error: reservationResult.error,
          message: reservationResult.message,
        },
        {
          status: reservationResult.status,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }
    reservationCreated = true;

    // === KROK 5: UPLOAD ZDJĘCIA UŻYTKOWNIKA DO STORAGE (SIGNED URL) ===
    const secureAvatarId = `base_user_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${userImageValidation.extension}`;
    userStoragePath = `users/${verifiedUid}/${secureAvatarId}`;

    const userFile = bucket.file(userStoragePath);
    await userFile.save(userImageBuffer, {
      contentType: userImageValidation.mimeType,
      resumable: false,
    });

    const [humanSignedUrl] = await userFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });

    // === KROK 6: WYWOŁANIE IDM-VTON (GRANICA PŁATNEGO WYWOŁANIA) ===
    const replicatePayload = {
      human_img: humanSignedUrl,
      garm_img,
      garment_des: finalGarmentDes,
      category: finalCategory,
      force_dc: finalForceDc,
      num_inference_steps: MODEL_INFERENCE_STEPS,
      guidance_scale: MODEL_GUIDANCE_SCALE,
      seed: MODEL_SEED,
      crop: false,
    };

    const output = await replicate.run(IDM_VTON_MODEL, { input: replicatePayload });
    const resultUri = Array.isArray(output) ? String(output[0]) : String(output);

    // === KROK 7: POBRANIE WYNIKU REPLICATE I ZAPIS DO TRWAŁEGO STORAGE (Z ROLLBACKIEM) ===
    let clientImageUrl = resultUri;
    if (resultUri.startsWith('https://')) {
      let resultFileCreated = false;
      let resultFileToRollback: ReturnType<typeof bucket.file> | null = null;
      let cacheRecordSaved = false;

      try {
        const resultImage = await safeFetchExternalImage(resultUri);
        const resultStoragePath = `try-on-results/${verifiedUid}/${cacheKey}.${resultImage.extension}`;
        const resultFile = bucket.file(resultStoragePath);
        resultFileToRollback = resultFile;

        await resultFile.save(resultImage.buffer, {
          contentType: resultImage.contentType,
          resumable: false,
        });
        resultFileCreated = true;

        await cacheRef.set({
          uid: verifiedUid,
          cacheKey,
          storagePath: resultStoragePath,
          detectedMimeType: resultImage.contentType,
          createdAt: Date.now(),
          modelIdentifier: IDM_VTON_MODEL,
          category: finalCategory,
          status: 'ready',
        });
        cacheRecordSaved = true;
        durableResultPersisted = true;

        const [freshResultSignedUrl] = await resultFile.getSignedUrl({
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });
        clientImageUrl = freshResultSignedUrl;
      } catch (saveErr) {
        if (resultFileCreated && !cacheRecordSaved && resultFileToRollback) {
          try {
            await resultFileToRollback.delete();
            console.log('[TRY-ON] Rollback: Pomyślnie usunięto osierocony plik Storage po błędzie zapisu Firestore.');
          } catch (deleteErr) {
            console.warn('[TRY-ON] Rollback warning: Nie udało się usunąć osieroconego pliku Storage:', deleteErr);
          }
        }
        console.warn('[TRY-ON] Nie udało się zapisać wyniku do trwałego Storage, fallback do bezpośredniego URI:', saveErr);
      }
    }

    // === KROK 7.5: ATOMOWA FINALIZACJA KREDYTU (reserved -> consumed) ===
    const finalizeRes = await finalizeTryOnCredit(adminDb, verifiedUid, activeRequestId);
    if (finalizeRes.ok) {
      creditFinalized = true;
    } else {
      console.error('[TRY-ON] Błąd finalizacji kredytu po uzyskaniu wyniku:', finalizeRes.error);
      throw new Error(`FINALIZE_CREDIT_FAILED: ${finalizeRes.error}`);
    }

    return NextResponse.json(
      { imageUrl: clientImageUrl },
      { headers: { 'Cache-Control': 'no-store' } }
    );

  } catch (error: unknown) {
    // Kontrolowany błąd: zwrot kredytu jest dopuszczalny WYŁĄCZNIE, gdy rezerwacja istnieje i wynik NIE został trwale zapisany
    if (reservationCreated && activeRequestId) {
      const canSafelyRefund =
        reservationCreated === true &&
        creditFinalized === false &&
        durableResultPersisted === false;

      if (canSafelyRefund) {
        try {
          await refundTryOnCredit(adminDb, verifiedUid, activeRequestId, 'ERROR_BEFORE_DURABLE_RESULT');
        } catch (refundErr) {
          console.error('[TRY-ON] Błąd podczas wycofywania rezerwacji kredytu:', refundErr);
        }
      } else {
        console.warn('[TRY-ON] Brak refundu: operacja pozostaje reserved dla ochrony kosztowej. Automatyczna rekonsyliacja nie jest obecnie dostępna, ponieważ integracja replicate.run() nie zapisuje provider prediction ID. Stan wymaga przyszłego mechanizmu rozliczania albo ręcznej interwencji.');
      }
    }

    if (isRateLimitError(error)) {
      console.warn('[TRY-ON] RATE LIMIT 429');
      return NextResponse.json(
        { error: "RATE_LIMIT", retryAfter: 12 },
        { status: 429, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.error('[TRY-ON] BŁĄD przetwarzania przymiarki');
    return NextResponse.json(
      { error: "Błąd serwera generowania przymiarki" },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );

  } finally {
    // === KROK 8: CLEANUP MUTEX + STORAGE ===
    if (currentSessionId) {
      releaseUserMutex(adminDb, verifiedUid, currentSessionId).catch(() => { });
    }
    if (userStoragePath) {
      bucket.file(userStoragePath).delete().catch(() => { });
    }
    if (proxyStoragePath) {
      bucket.file(proxyStoragePath).delete().catch(() => { });
    }
  }
}