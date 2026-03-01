import Replicate from "replicate";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";


// ZADANIE 2: Niezawodna Detekcja Kategorii (Fallback)
function detectGarmentCategory(title: string | undefined): 'upper_body' | 'lower_body' | 'dresses' {
  if (!title) return "upper_body";
  const t = title.toLowerCase();
  if (t.includes("spodnie") || t.includes("spódnica") || t.includes("jeans") || t.includes("szort")) return "lower_body";
  if (t.includes("sukienka") || t.includes("suknia")) return "dresses";
  return "upper_body";
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  let proxyStorageRef: any = null;
  let userImageStorageRef: any = null;
  let globalUid: string = '';

  try {
    const { uid, personImage, clothingImage, category, productTitle, bodyTypeModifier } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "Brak autoryzacji sesji. Zaloguj się by dokonać przymiarki." }, { status: 401 });
    }

    globalUid = uid;

    // Logowanie diagnostyczne dla terminala
    console.log('--- START PRZYMIERZALNI ---');
    console.log('Kategoria:', category);
    console.log('Produkt:', productTitle);

    // KROK -2: VTON CACHE (PAMIĘĆ WYNIKÓW)
    console.log('--- PIPELINE: FIRESTORE CACHE ---');
    // Generowanie stabilnego Hasha MD5 (Optymalizacja Base64)
    // Tniemy ogromny base64 do fingerprintu (np. pierwsze 200 znaków trzonowych) i łączymy z linkiem sklepu 
    const humanFingerprint = personImage.substring(personImage.indexOf(',') + 1, personImage.indexOf(',') + 201);
    const hashString = `${uid}_${humanFingerprint}_${clothingImage}_${category}_${productTitle}`;
    const cacheHash = crypto.createHash('md5').update(hashString).digest('hex');
    const cacheRef = doc(db, 'vton_cache', cacheHash);

    try {
      const cacheDoc = await getDoc(cacheRef);
      if (cacheDoc.exists()) {
        console.log(`ZNALEZIONO W CACHE! Ominięcie Replicate (Hash: ${cacheHash})`);
        return NextResponse.json({ imageUrl: cacheDoc.data()?.imageUrl, cached: true });
      }
    } catch (cacheErr: any) {
      console.warn("CACHE READ WARNING:", cacheErr.message);
    }

    // KROK -1: FIRESTORE PER-USER MUTEX (Zabezpieczenie przed Kolejkowaniem API pod jedno konto)
    console.log('--- PIPELINE: FIRESTORE MUTEX ---');
    // Blokada jest teraz nakładana na konkretnego użytkownika (wiele osób może korzystać naraz z Vercel, ale jednostka ma ratelimit)
    const sessionRef = doc(db, 'active_sessions', uid);

    const sessionDoc = await getDoc(sessionRef);
    if (sessionDoc.exists() && sessionDoc.data()?.status === 'processing') {
      const lockData = sessionDoc.data();
      const lockAge = Date.now() - (lockData?.timestamp || 0);

      // Auto-unlock (Deadlock protection) po 3 minutach
      if (lockAge < 180000) {
        console.warn('MUTEX ZADZIAŁAŁ: Przerwano request. Stylistka zajęta.');
        return NextResponse.json(
          { error: "Wirtualna Stylistka jest aktualnie bardzo zajęta przez inną przymiarkę. Oczekaj chwileczkę...", mutexLocked: true },
          { status: 409 }
        );
      } else {
        console.log('MUTEX DEADLOCK: Sesja przestarzała. Nadpisuję i kontynuuję.');
      }
    }

    // Zakluczenie zasobu Serwera
    await setDoc(sessionRef, { status: 'processing', timestamp: Date.now() });

    // KROK 0.A: PRIVACY GUARD (Zdjęcie użytkownika na własny Storage)
    console.log('--- PIPELINE: PRIVACY GUARD (STORAGE) ---');
    let secureUserImageUrl = '';
    try {
      // Dekodowanie Base64 od klienta Data URI do Buforu Binarnego Pamięci
      const base64Data = (personImage as string).replace(/^data:image\/\w+;base64,/, "");
      const userImageBuffer = Buffer.from(base64Data, 'base64');
      const uint8UserArray = new Uint8Array(userImageBuffer);

      const secureAvatarId = `base_user_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      userImageStorageRef = ref(storage, `users/${uid}/${secureAvatarId}`);

      await uploadBytes(userImageStorageRef, uint8UserArray, { contentType: 'image/jpeg' });
      secureUserImageUrl = await getDownloadURL(userImageStorageRef);

      console.log(`SUKCES PRIVACY: Zdjęcie Użytkownika uploadowane dyskretnie na chmurę (${secureUserImageUrl})`);
    } catch (privacyErr: any) {
      console.warn('PRIVACY STORAGE ERROR: Nie podołano zabezpieczyć obrazu uzytkownika.', privacyErr.message);
      throw new Error("Prywatność zawiodła. Serwer odmawia publicznego proxy na wejściu API.");
    }

    // KROK 0.B: IMAGE PROXY (HOTLINK OMINIĘCIE 403 PRZEZ FIREBASE STORAGE)
    console.log('--- PIPELINE: FIREBASE STORAGE PROXY ---');
    let proxiedClothingImage = clothingImage;
    if (clothingImage && clothingImage.startsWith('http')) {
      try {
        console.log(`Pobieranie w locie: ${clothingImage}`);
        const proxyRes = await fetch(clothingImage, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        });

        if (!proxyRes.ok) {
          console.warn(`IMAGE PROXY HTTP ALERT: ${proxyRes.status} dla pliku ${clothingImage}. Ostrzeżenie.`);
        } else {
          const arrayBuffer = await proxyRes.arrayBuffer();
          const mimeType = proxyRes.headers.get('content-type') || 'image/jpeg';

          // Generowanie unikalnej nazwy i rozszerzenia w Bucketcie
          const ext = mimeType.split('/')[1] || 'jpg';
          const fileId = `garm_proxy_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

          const storageRef = ref(storage, `proxied/${fileId}`);
          proxyStorageRef = storageRef;

          // Bezpieczny upload buforu Uint8Array dla SDK klienckiego
          const uint8Array = new Uint8Array(arrayBuffer);
          await uploadBytes(storageRef, uint8Array, { contentType: mimeType });

          // Pobranie bezpośredniego linku do pliku ze Storage ("Signed URL" u klienta)
          const downloadUrl = await getDownloadURL(storageRef);

          proxiedClothingImage = downloadUrl;
          console.log(`SUKCES: Plik odzieży uploadowany na Firebase: ${fileId} (${downloadUrl})`);
        }

      } catch (proxyErr: any) {
        console.warn('IMAGE PROXY FATAL ERROR: Nie potrafiono uploadować zdjęcia na Storage.', proxyErr.message);
      }
    }

    // KROK 1: PIPELINE REMOVE BACKGROUND (ZADANIE 1)
    console.log('--- PIPELINE: REMOVE BACKGROUND ---');
    let processedClothingImage = proxiedClothingImage;
    try {
      // Model cjwbw/rembg (lub podobny szybki model z Replicate)
      const rembgModel = "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5bad4c24d46248d146cfdada2ed";
      const rembgOutput = await replicate.run(rembgModel, {
        input: {
          image: proxiedClothingImage
        }
      });
      if (rembgOutput) {
        processedClothingImage = String(rembgOutput);
        console.log('SUCCESS: Usunięto tło pomyślnie.');
      }
    } catch (bgError: any) {
      console.log('WARNING: Błąd usuwania tła. Używam oryginału jako fallback.', bgError.message);
      // Nie zgłaszamy błędu żeby VTON mógł ruszyć mimo awarii rembg.
    }

    // ZADANIE 2: Hard-override kategorii za pomocą twardego parsera
    const safeCategory = detectGarmentCategory(productTitle);
    console.log('Bezpieczna kategoria (Override):', safeCategory);

    // ZADANIE 3: "Żelazny Prompt" sterujący Replicate - SUROWE WSKAZANIA TECHNICZNE
    const finalPrompt = "Ubiór musi zachować dokładnie swoją pierwotną długość, krój i proporcje. Zachowaj tożsamość twarzy i sylwetki użytkownika. photorealistic, 8k";
    const negativePrompt = "wrong length, mutated, changed identity, cartoon, lowres, bad proportions, bad fit, background noise";

    // To jest aktualna i stabilna wersja modelu (Luty 2026)
    const modelVersion = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

    // ZADANIE 4: Przekazanie zaawansowanego payloadu
    const output = await replicate.run(modelVersion, {
      input: {
        human_img: secureUserImageUrl,
        garm_img: processedClothingImage, // Zdjęcie po Remove-BG
        garment_des: finalPrompt, // Dla starszych/standardowych IDM-VTON
        prompt: finalPrompt, // Czasami używane zamiennie w innych wersjach VTON
        negative_prompt: negativePrompt,
        category: safeCategory === 'dresses' ? 'dresses' : safeCategory,
        force_dc: safeCategory === "dresses",
        num_inference_steps: 30, // Standardowe nadpisywanie krokow w nowym VTON
        steps: 30, // Fallback klucza
        guidance_scale: 2.5,
        seed: 42,
        crop: false
      }
    });

    // ZADANIE 2: Brutalna eliminacja błędu [object Object] / URL()
    const finalImageUrl = Array.isArray(output) ? String(output[0]) : String(output);

    console.log('SUKCES: Wygenerowano obraz pomyślnie.');

    // KROK 4.5: ZAPIS WYNIKU DO VTON CACHE (PAMIĘĆ)
    try {
      await setDoc(cacheRef, {
        imageUrl: finalImageUrl,
        timestamp: Date.now(),
        category: category,
        productTitle: productTitle
      });
      console.log(`SUKCES CACHE: Zapisano wektor wyjściowy pod md5: ${cacheHash}`);
    } catch (cacheWriteErr: any) {
      console.warn("CACHE WRITE WARNING:", cacheWriteErr.message);
    }

    // KROK 5: CLEANUP Mutexa - zwolnienie zasobu na sukces
    await deleteDoc(doc(db, 'active_sessions', uid));

    // KROK 6: CLEANUP STORAGE - usunięcie proxy image
    if (proxyStorageRef) {
      try {
        await deleteObject(proxyStorageRef);
        console.log('SUKCES CLEANUP: Usunięto tymczasowy obraz Proxy ze Storage Firebase.');
      } catch (cleanupErr: any) {
        console.warn('OSTRZEŻENIE CLEANUP:', cleanupErr.message);
      }
    }

    // KROK 6.B: CLEANUP PRIVACY GUARD - usunięcie pliku użytkownika pod RODO
    if (userImageStorageRef) {
      try {
        await deleteObject(userImageStorageRef);
        console.log('SUKCES CLEANUP PRIVACY: Usunięto prywatne zdjęcie Skanera ze Storage Firebase.');
      } catch (cleanupErr: any) {
        console.warn('OSTRZEŻENIE CLEANUP PRIVACY:', cleanupErr.message);
      }
    }

    return NextResponse.json({ imageUrl: finalImageUrl });
  } catch (error: any) {
    // ZADANIE 1: Bezpieczny Backend (Ochrona przed limitem Burst=1)
    if (error?.response?.status === 429 || error?.status === 429) {
      console.warn("TRY-ON RATE LIMIT (429): Kolejka Replicate pełna.");

      if (proxyStorageRef) {
        try { await deleteObject(proxyStorageRef); } catch (e) { }
      }
      if (userImageStorageRef) {
        try { await deleteObject(userImageStorageRef); } catch (e) { }
      }

      return NextResponse.json(
        { error: "RATE_LIMIT", retryAfter: 10 },
        { status: 429 }
      );
    }

    console.error("BŁĄD REPLICATE:", error.message);

    // KROK 5: CLEANUP Mutexa - zwolnienie zasobu w errorze twardym
    try {
      if (globalUid) {
        await deleteDoc(doc(db, 'active_sessions', globalUid));
      }
    } catch (cleanupErr) { console.error('MUTEX CLEANUP ERROR', cleanupErr) }

    // KROK 6: CLEANUP STORAGE w errorze twardym
    if (proxyStorageRef) {
      try { await deleteObject(proxyStorageRef); } catch (e) { }
    }
    if (userImageStorageRef) {
      try { await deleteObject(userImageStorageRef); } catch (e) { }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}