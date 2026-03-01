import Replicate from "replicate";
import { NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  try {
    const { personImage, clothingImage, category, productTitle, bodyTypeModifier } = await req.json();

    // Logowanie diagnostyczne dla terminala
    console.log('--- START PRZYMIERZALNI ---');
    console.log('Kategoria:', category);
    console.log('Produkt:', productTitle);

    // KROK -1: FIRESTORE GLOBAL MUTEX (Zabezpieczenie przed błędem 429)
    console.log('--- PIPELINE: FIRESTORE MUTEX ---');
    // Generujemy syntetyczne IP docelowo, w prawdziwej aplikacji byłoby to np. localStorage UUID z Frontendu
    // Ponieważ nie mamy pewności co do stanu frontendu, robimy symulowaną kolejkę na całą platformę "Global Lock"
    const GLOBAL_SESSION_ID = 'singleton-vton-session';
    const sessionRef = doc(db, 'active_sessions', GLOBAL_SESSION_ID);

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

    // KROK 0: IMAGE PROXY (HOTLINK OMINIĘCIE 403 PRZEZ FIREBASE STORAGE)
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
        human_img: personImage,
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

    // KROK 5: CLEANUP Mutexa - zwolnienie zasobu na sukces
    await deleteDoc(doc(db, 'active_sessions', 'singleton-vton-session'));

    return NextResponse.json({ imageUrl: finalImageUrl });
  } catch (error: any) {
    // ZADANIE 1: Bezpieczny Backend (Ochrona przed limitem Burst=1)
    if (error?.response?.status === 429 || error?.status === 429) {
      console.warn("TRY-ON RATE LIMIT (429): Kolejka Replicate pełna.");
      return NextResponse.json(
        { error: "RATE_LIMIT", retryAfter: 10 },
        { status: 429 }
      );
    }

    console.error("BŁĄD REPLICATE:", error.message);

    // KROK 5: CLEANUP Mutexa - zwolnienie zasobu w errorze twardym
    try {
      await deleteDoc(doc(db, 'active_sessions', 'singleton-vton-session'));
    } catch (cleanupErr) { console.error('MUTEX CLEANUP ERROR', cleanupErr) }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}