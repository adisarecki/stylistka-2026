import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const size = searchParams.get('size');

  let query = q || '';

  // DYNAMICZNE DODANIE ROZMIARU DO ZAPYTANIA (Twardy Filtr)
  if (size && query) {
    query = `${query} +intext:"${size}"`;
  }

  const serperApiKey = process.env.SERPER_API_KEY;

  console.log("--- LOGOWANIE ENV (SERPER) ---");
  console.log("SERPER_API_KEY EXISTS:", !!serperApiKey);

  if (!serperApiKey) {
    console.error("❌ BRAK: SERPER_API_KEY w .env.local");
    return NextResponse.json({ error: 'Brak klucza API Serper' }, { status: 500 });
  }

  if (!query) {
    return NextResponse.json({ error: 'Brak zapytania' }, { status: 400 });
  }

  try {
    console.log('--- DIAGNOSTYKA WYSZUKIWARKI (SERPER) ---');
    console.log('KROK 1: Próba z twardym filtrem rozmiaru:', query);

    const callSerper = async (q: string) => {
      const resp = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q, num: 10 })
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(`Serper API Error: ${resp.status} - ${JSON.stringify(errData)}`);
      }
      return await resp.json();
    };

    let data;
    let isAlternative = false;

    // Próba uderzenia z twardym rozmiarem (KROK 1)
    try {
      data = await callSerper(query);

      // Jeśli Serper odpowie 200 OK, ale nic nie znajdzie, wymuszamy przejście do Fallbacku
      if (!data.images || data.images.length === 0) {
        throw new Error("Pusta lista wyników z filtrem rozmiaru");
      }
    } catch (fallbackError: any) {
      // KROK 2: Graceful Fallback (uruchamia się, gdy brak wyników LUB Serper odrzuci składnię)
      console.log('⚠️ BRAK WYNIKÓW LUB BŁĄD SKŁADNI. Uruchamiam Graceful Fallback...');
      data = await callSerper(q || ''); // Szukamy czystego zapytania, bez rozmiaru
      isAlternative = true;
    }

    // Mapowanie wyników Serper na format karuzeli
    const products = data.images?.map((item: any, index: number) => {
      let storeName = 'Sklep';
      try {
        const url = new URL(item.link);
        storeName = url.hostname.replace('www.', '');
      } catch (e) {
        storeName = item.source || 'Sklep';
      }

      return {
        id: `serper-${index}`,
        name: item.title,
        price: 'Zobacz ofertę',
        store: storeName,
        imageUrl: item.imageUrl,
        link: item.link
      };
    }) || [];

    console.log(`✅ FINISZER (SERPER): Znaleziono ${products.length} produktów. Alternatywne: ${isAlternative}`);
    return NextResponse.json({ products, isAlternative });

  } catch (error: any) {
    console.error("🔥 SERPER KRYTYCZNY BŁĄD:", error.message);
    // Jeśli nawet fallback zawiedzie
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
