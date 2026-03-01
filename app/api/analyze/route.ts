import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { image, query, occasion, gender } = await req.json();

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
        - Każdy werdykt MUSI kończyć się przypisaniem do jednej z powyższych 5 kategorii w polu "bodyShape".
        - Dostosuj rady ściśle do obrazu, promując kroje pod VTON (np. dla Jabłka sukienki empire omijające brzuch). Zabraniam używania ogólnych porad.
        - Złota zasada ostrości (Focus): Jeśli użytkownik szuka obuwia (np. "buty"), patrz tylko na nogi. Jeśli szuka odzieży, analizuj całość.
        
        Użytkownik szuka: ${query} na okazję: ${occasion}.
        Preferencja płci/kroju (opcjonalnie): ${gender || "Domyślnie - rozpoznaj płeć automatycznie na podstawie zdjęcia"}.
        ZASADA: Słowa kluczowe w wynikach wyszukiwania (apiQuery) mają precyzować płeć jeśli to wykryjesz.
        
        Zwróć odpowiedź WYŁĄCZNIE jako czysty obiekt JSON:
        {
          "uiTitle": "elegancki tytuł (np. 'Królowa Balu: Idealna dla Klepsydry')",
          "apiQuery": "precyzyjne zapytanie techniczne do wyszukiwarki Serper (np. 'sukienka damska V-mini') - bez modyfikatorów sylwetki",
          "stylistComment": "profesjonalny komentarz (najwyzej zdanie)",
          "bodyShape": "JABŁKO",
          "strength": "atut widoczny na zdjęciu do pochwały",
          "advice": "konkretna porada fasonowa",
          "avoid": "czego unikać",
          "garmentDetails": {
             "color": "kolor po polsku",
             "garmentType": "typ ubrania po polsku",
             "cut": "krój ubrania",
             "occasion": "okazja podana z promptu"
          },
          "replicateCategory": "string", // MUSI być: "upper_body", "lower_body" lub "dresses"
          "replicatePrompt": "string" // Np. "long black evening gown, floor length, highly detailed, covering legs"
        }

        Instrukcja dodatkowa: Jako ekspert mody, dla każdego produktu wygeneruj precyzyjny opis po angielsku do modelu VTON (pole replicatePrompt) oraz określ kategorię (replicateCategory). Jeśli to sukienka, zawsze wymuszaj opis długości i zakrycia nóg (np. 'covering legs, covering thick straps, full body dress'). To zapobiegnie halucynacjom modelu obrazkowego.`
      },
    ];

    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();

    console.log("Gemini raw response:", text);

    try {
      const jsonResponse = JSON.parse(text);
      return NextResponse.json(jsonResponse);
    } catch (parseError) {
      console.error("JSON Parse Error in /api/analyze:", parseError);
      return NextResponse.json({
        uiTitle: "Wybrano dla Ciebie",
        apiQuery: query || "odzież",
        stylistComment: "Eksperymentuj z fasonami.",
        bodyShape: "NIEZNANA",
        strength: "Twoja sylwetka ma wiele atutów.",
        advice: text,
        avoid: "Zaburzone proporcje",
        garmentDetails: {},
        replicateCategory: "upper_body",
        replicatePrompt: "photorealistic clothing, highly detailed"
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
