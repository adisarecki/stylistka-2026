import Replicate from "replicate";
import { NextResponse } from "next/server";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const { personImage, clothingImage, category } = await req.json();

    // Logowanie diagnostyczne dla terminala
    console.log('--- START PRZYMIERZALNI ---');
    console.log('Kategoria:', category);

    // To jest aktualna i stabilna wersja modelu (Luty 2026)
    const modelVersion = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

    const output = await replicate.run(modelVersion, {
      input: {
        human_img: personImage,
        garm_img: clothingImage,
        garment_des: "Suggested clothing",
        category: category === 'dresses' ? 'dresses' : (category || 'upper_body'),
        force_dc: category === "dresses", 
        steps: 30,
        seed: 42,
        crop: false
      }
    });

    // FIX DLA [object Object]: Wyciągamy czysty link URL z tablicy Replicate
    const resultUrl = Array.isArray(output) ? output[0] : output;

    console.log('SUKCES: Wygenerowano obraz:', resultUrl);

    return NextResponse.json({ result: resultUrl });
  } catch (error: any) {
    console.error("BŁĄD REPLICATE:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}