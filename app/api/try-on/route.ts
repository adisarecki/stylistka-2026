import Replicate from "replicate";
import { NextResponse } from "next/server";

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

    // KROK 1: PIPELINE REMOVE BACKGROUND (ZADANIE 1)
    console.log('--- PIPELINE: REMOVE BACKGROUND ---');
    let processedClothingImage = clothingImage;
    try {
      // Model cjwbw/rembg (lub podobny szybki model z Replicate)
      const rembgModel = "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5bad4c24d46248d146cfdada2ed";
      const rembgOutput = await replicate.run(rembgModel, {
        input: {
          image: clothingImage
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

    // ZADANIE 3: "Żelazny Prompt" sterujący Replicate
    const finalPrompt = "photorealistic try-on, correct proportions, preserve pose, do not change face, natural fit, correct sleeves alignment, high quality, 8k";
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}