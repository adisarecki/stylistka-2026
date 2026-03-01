import Replicate from "replicate";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";



const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Wersja IDM-VTON (stabilna, marzec 2026)
const IDM_VTON_MODEL = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

export async function POST(req: Request) {
  let proxyStorageRef: any = null;
  let userImageStorageRef: any = null;
  let globalUid: string = '';

  try {
    const { uid, personImage, clothingImage, category, productTitle, bodyTypeModifier, replicatePrompt } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "Brak autoryzacji sesji. Zaloguj się by dokonać przymiarki." }, { status: 401 });
    }

    globalUid = uid;

    // === KROK 1: PRIVACY GUARD - Upload zdjęcia użytkownika do prywatnego folderu Firebase Storage ===
    console.log('[TRY-ON] Krok 1: Privacy Guard – upload zdjęcia użytkownika...');
    let human_img = '';
    try {
      const base64Data = (personImage as string).replace(/^data:image\/\w+;base64,/, "");
      const userImageBuffer = Buffer.from(base64Data, 'base64');
      const uint8UserArray = new Uint8Array(userImageBuffer);

      const secureAvatarId = `base_user_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      userImageStorageRef = ref(storage, `users/${uid}/${secureAvatarId}`);

      await uploadBytes(userImageStorageRef, uint8UserArray, { contentType: 'image/jpeg' });
      human_img = await getDownloadURL(userImageStorageRef);

      console.log(`[TRY-ON] human_img zabezpieczony w Storage: ${human_img}`);
    } catch (privacyErr: any) {
      console.error('[TRY-ON] BŁĄD Privacy Guard:', privacyErr.message);
      throw new Error("Nie udało się zabezpieczyć zdjęcia użytkownika. Spróbuj ponownie.");
    }

    // === KROK 2: IMAGE PROXY - Upload odzieży do Firebase Storage (Fix 403) ===
    console.log('[TRY-ON] Krok 2: Image Proxy – upload odzieży do Storage...');
    let garm_img = clothingImage;
    if (clothingImage && clothingImage.startsWith('http')) {
      try {
        const proxyRes = await fetch(clothingImage, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        });

        if (proxyRes.ok) {
          const arrayBuffer = await proxyRes.arrayBuffer();
          const mimeType = proxyRes.headers.get('content-type') || 'image/jpeg';
          const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
          const fileId = `garm_proxy_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

          proxyStorageRef = ref(storage, `proxied/${fileId}`);
          await uploadBytes(proxyStorageRef, new Uint8Array(arrayBuffer), { contentType: mimeType });
          garm_img = await getDownloadURL(proxyStorageRef);
          console.log(`[TRY-ON] garm_img proxied do Storage: ${garm_img}`);
        } else {
          console.warn(`[TRY-ON] Proxy fetch zwrócił ${proxyRes.status} – używam oryginalnego URL jako fallback.`);
        }
      } catch (proxyErr: any) {
        console.warn('[TRY-ON] Image Proxy error – używam oryginalnego URL:', proxyErr.message);
      }
    }

    // === KROK 3: CACHE-FIRST – Sprawdzenie try_on_results w Firestore ===
    // Hash oparty na URL Storage (stabilny, nie bazuje na zmiennym base64)
    const cacheHash = crypto.createHash('md5')
      .update(`${uid}|${garm_img}|${productTitle || ''}`)
      .digest('hex');
    const cacheRef = doc(db, 'try_on_results', cacheHash);

    console.log(`[TRY-ON] Krok 3: Cache-First check (hash: ${cacheHash})...`);
    try {
      const cacheDoc = await getDoc(cacheRef);
      if (cacheDoc.exists()) {
        console.log('[TRY-ON] HIT CACHE – zwracam wynik z Firestore bez Replicate!');
        return NextResponse.json({ imageUrl: cacheDoc.data()?.imageUrl, cached: true });
      }
    } catch (cacheReadErr: any) {
      console.warn('[TRY-ON] Cache read error (ignoruję):', cacheReadErr.message);
    }

    // === KROK 4: PER-USER MUTEX – Blokada w Firestore ===
    console.log('[TRY-ON] Krok 4: Per-User Mutex...');
    const sessionRef = doc(db, 'active_sessions', uid);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists() && sessionDoc.data()?.status === 'processing') {
      const lockAge = Date.now() - (sessionDoc.data()?.timestamp || 0);
      if (lockAge < 180000) { // 3 minuty
        console.warn('[TRY-ON] MUTEX: Sesja zajęta!');
        return NextResponse.json(
          { error: "Wirtualna Stylistka jest zajęta inną przymiarką. Poczekaj chwilę.", mutexLocked: true },
          { status: 409 }
        );
      }
      console.log('[TRY-ON] MUTEX: Deadlock – sesja przeterminowana, nadpisuję.');
    }
    await setDoc(sessionRef, { status: 'processing', timestamp: Date.now(), uid });

    // === KROK 5: WYWOŁANIE IDM-VTON (Rura AI-to-AI z Gemini) ===

    // ZADANIE 2: Czyste przekazanie kategorii z frontendu (od Gemini)
    const finalCategory = category === 'dresses' ? 'dresses' : category === 'lower_body' ? 'lower_body' : 'upper_body';

    // ZADANIE 3: Blokada halucynacji - garment_des to teraz replicatePrompt z Gemini (połączony z modyfikatorem sylwetki)
    const baseGarmentDes = replicatePrompt || productTitle || 'photorealistic clothing, highly detailed';
    const garment_des = bodyTypeModifier
      ? `${baseGarmentDes}. ${bodyTypeModifier}`
      : baseGarmentDes;

    // ZADANIE 2: Automatyczne force_dc dla sukienek zdefiniowane przez Gemini
    const isDress = finalCategory === 'dresses';

    // ZADANIE 2: Wzmocnienie "garment_des" (Przełamywanie Maski)
    let finalGarmentDes = garment_des;
    if (isDress) {
      finalGarmentDes += ", FULL LENGTH MAXI DRESS, COVERING LEGS ENTIRELY DOWN TO THE FLOOR";
    }

    const replicatePayload = {
      human_img,                         // POLE 1: Zdjęcie użytkownika
      garm_img,                          // POLE 2: Zdjęcie odzieży
      garment_des: finalGarmentDes,      // POLE 3: Opis odzieży (z twardym narzuceniem długości)
      category: finalCategory,           // POLE 4: upper_body | lower_body | dresses
      force_dc: isDress,                 // POLE 5: Zgodnie ze specyfikacją Replicate
      num_inference_steps: 30,
      guidance_scale: 2.5,
      seed: 42,
      crop: false                        // ZADANIE 3: Blokada ucinania krawędzi (Crop=false)
    };

    console.log(`[TRY-ON] Krok 5: Wywołanie IDM-VTON – kategoria: ${finalCategory}`);
    // ZADANIE 1: Twardy dowód w logach (Weryfikacja Payloadu)
    console.log(`[TRY-ON] PAYLOAD WYSYŁANY DO REPLICATE:\n${JSON.stringify(replicatePayload, null, 2)}`);

    const output = await replicate.run(IDM_VTON_MODEL, { input: replicatePayload });

    // IDM-VTON zwraca URI (string lub array)
    const resultUri = Array.isArray(output) ? String(output[0]) : String(output);
    console.log(`[TRY-ON] Sukces! URI: ${resultUri}`);

    // === KROK 6: ZAPIS WYNIKU DO try_on_results (kolekcja zgodna z Zadaniem 2) ===
    try {
      await setDoc(cacheRef, {
        imageUrl: resultUri,
        uid,
        garm_img: clothingImage, // Oryginał dla referencji
        productTitle: productTitle || '',
        category: finalCategory,
        timestamp: Date.now()
      });
      console.log(`[TRY-ON] Wynik zapisany w try_on_results/${cacheHash}`);
    } catch (cacheWriteErr: any) {
      console.warn('[TRY-ON] Cache write warning:', cacheWriteErr.message);
    }

    // === KROK 7: CLEANUP – Mutex + Storage ===
    await deleteDoc(sessionRef).catch(() => { });

    if (proxyStorageRef) {
      deleteObject(proxyStorageRef).catch(() => { }); // Fire & forget – nie blokujemy odpowiedzi
    }
    if (userImageStorageRef) {
      deleteObject(userImageStorageRef).catch(() => { }); // RODO: auto-destrukcja po sukcesie
    }

    return NextResponse.json({ imageUrl: resultUri });

  } catch (error: any) {
    // Obsługa Rate Limit (429)
    if (error?.response?.status === 429 || error?.status === 429 || error?.message?.includes('429')) {
      console.warn('[TRY-ON] RATE LIMIT 429 – Replicate przeciążony.');
      if (proxyStorageRef) deleteObject(proxyStorageRef).catch(() => { });
      if (userImageStorageRef) deleteObject(userImageStorageRef).catch(() => { });
      return NextResponse.json({ error: "RATE_LIMIT", retryAfter: 12 }, { status: 429 });
    }

    console.error('[TRY-ON] BŁĄD:', error.message);

    // Cleanup Mutex w przypadku błędu
    if (globalUid) {
      deleteDoc(doc(db, 'active_sessions', globalUid)).catch(() => { });
    }
    if (proxyStorageRef) deleteObject(proxyStorageRef).catch(() => { });
    if (userImageStorageRef) deleteObject(userImageStorageRef).catch(() => { });

    return NextResponse.json({ error: error.message || "Błąd serwera" }, { status: 500 });
  }
}