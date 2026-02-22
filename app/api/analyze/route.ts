import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { image, query, occasion } = await req.json();

    const modelName = "gemini-2.5-flash"; // Updated to stable 2.5-flash
    console.log("API KEY EXISTS:", !!process.env.GOOGLE_API_KEY);
    console.log("Using model:", modelName);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });

    // AI Studio wysyła czyste dane. My musimy wyciąć nagłówek base64.
    const base64Data = image.split(",")[1];

    // Tworzymy paczkę multimodalną (Obraz + Tekst)
    const content = [
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
      {
        text: `Jesteś bezkompromisową, profesjonalną stylistką-ekspertem. Twoim zadaniem jest analiza sylwetki na podstawie zdjęcia i przypisanie jej do jednej z kategorii z oficjalnej SIATKI TYPÓW SYLWETEK:
        
        SIATKA TYPÓW SYLWETEK:
        1. JABŁKO (XXL/O) - szeroki tułów, brak wcięcia w talii, często szczupłe nogi.
        2. GRUSZKA (A) - biodra szersze od ramion, wyraźna talia.
        3. KLEPSYDRA (X) - ramiona i biodra tej samej szerokości, wyraźne wcięcie w talii.
        4. KOLUMNA (H) - ramiona i biodra tej samej szerokości, brak wyraźnego wcięcia w talii, szczupła budowa.
        5. ROŻEK (V) - ramiona szersze od bioder, wąska miednica.

        Zasady kategoryczne:
        - Każdy werdykt MUSI kończyć się przypisaniem do jednej z powyższych 5 kategorii w polu "figureType".
        - Jeśli widzisz sylwetkę typu Jabłko, zaproponuj fasony empire, które maskują okolicę brzucha i eksponują Twoje atuty (np. dekolt, nogi).
        - Dostosuj rady ściśle do obrazu. Zabraniam używania ogólnych porad.
        
        Użytkownik szuka: ${query} na okazję: ${occasion}.
        
        Zwróć odpowiedź WYŁĄCZNIE jako czysty obiekt JSON:
        {
          "uiTitle": "elegancki tytuł (np. 'Królowa Balu: Idealna dla Klepsydry')",
          "apiQuery": "precyzyjne zapytanie techniczne do wyszukiwarki (np. 'sukienka empire dekolt V -mini') - nie dodawaj filtrów dynamicznych tutaj, kod doda je automatycznie",
          "stylistComment": "profesjonalny komentarz (max 150 znaków) uzasadniający wybór pod konkretny typ sylwetki",
          "figureType": "JABŁKO | GRUSZKA | KLEPSYDRA | KOLUMNA | ROŻEK",
          "strength": "realny atut widoczny na zdjęciu",
          "advice": "konkretna porada fasonowa dla tego typu sylwetki",
          "avoid": "czego unikać (nie powielaj oczywistości)"
        }`
      },
    ];

    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();

    console.log("Gemini raw response:", text);

    try {
      const jsonResponse = JSON.parse(text);

      // DYNAMICZNY FILTR: Wzmocnienie zapytania dla typu Jabłko
      if (jsonResponse.figureType && jsonResponse.figureType.toUpperCase().includes("JABŁKO")) {
        console.log("Applying expert filter for Apple physique");
        jsonResponse.apiQuery = `${jsonResponse.apiQuery} +empire +maskująca talia`;
      }

      return NextResponse.json(jsonResponse);
    } catch (parseError) {
      console.error("JSON Parse Error in /api/analyze:", parseError);
      // Fallback object to ensure frontend doesn't crash
      return NextResponse.json({
        uiTitle: "Wybrano dla Ciebie",
        apiQuery: query || "odzież",
        stylistComment: "Eksperymentuj z fasonami, aby podkreślić swój unikalny styl.",
        figureType: "Analiza sylwetki",
        strength: "Twoja sylwetka ma wiele atutów.",
        advice: text,
        avoid: "Szczegóły w opisie"
      });
    }

  } catch (error: any) {
    console.error("Gemini error:", error);
    return NextResponse.json(
      { error: "AI temporarily unavailable" },
      { status: 500 }
    );
  }
}
