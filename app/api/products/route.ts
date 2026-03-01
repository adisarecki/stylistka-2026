import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const size = searchParams.get('size');

  const color = searchParams.get('color');
  const type = searchParams.get('type');
  const cut = searchParams.get('cut');
  const occasion = searchParams.get('occasion');

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

    const callSerper = async (searchQuery: string, useModifiers: boolean = true) => {
      // Wstrzyknięcie Whitelisty i wykluczeń (Retail-Only Filter dla VTON)
      let finalQuery = searchQuery;

      if (useModifiers) {
        if (color && type) {
          // Parametryczne zapytanie z Gemini (Silnik Zapytań)
          const cutPart = cut ? ` +${cut}` : '';
          const baseQuery = `+${color} +${type}${cutPart}`;
          finalQuery = `${baseQuery} +packshot +"białe tło" site:zalando.pl OR site:modivo.pl OR site:answear.com OR site:hm.com -portfolio -fotograf -usługi -sesja -buty -torebka -szpilki -modelka -editorial`;
        } else {
          // Standardowy Fallback dla starszych wyszukiwań bez meta-danych ubrań
          finalQuery = `"${searchQuery}" +packshot +"białe tło" (site:zalando.pl OR site:answear.com OR site:modivo.pl OR site:hm.com) -portfolio -fotograf -sesja -fotografia -usługi -modelka`;
        }
      }

      console.log('-> Serper Request Q:', finalQuery);

      const resp = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: finalQuery, num: 10 })
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(`Serper API Error: ${resp.status} - ${JSON.stringify(errData)}`);
      }
      return await resp.json();
    };

    let data;
    let isAlternative = false;

    // Próba uderzenia z twardym rozmiarem i packshotem (KROK 1)
    try {
      data = await callSerper(query, true);

      if (!data.images || data.images.length === 0) {
        throw new Error("Pusta lista wyników z filtrem rozmiaru i packshotem");
      }
    } catch (error1: any) {
      // KROK 2: Fallback bez rozmiaru, ale z packshotem
      console.log('⚠️ BRAK WYNIKÓW (KROK 1). Szukam bez rozmiaru, z wymuszeniem packshotu...');
      try {
        data = await callSerper(q || '', true);
        isAlternative = true;
        if (!data.images || data.images.length === 0) {
          throw new Error("Pusta lista wyników z samym packshotem");
        }
      } catch (error2: any) {
        // KROK 3: Hard Fallback - całkowicie surowe zapytanie
        console.log('⚠️ BRAK WYNIKÓW (KROK 2). Uruchamiam Hard Fallback (czyste zapytanie)...');
        data = await callSerper(q || '', false);
        isAlternative = true;
      }
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

    // Generowanie ostatecznego JSON-a wraz z meta-danymi na cele parametryczne
    return NextResponse.json({
      products,
      isAlternative,
      generatedQuery: (color && type && !isAlternative) ? `+${color} +${type} ${cut ? `+${cut}` : ''} site:...` : query,
      garmentMetadata: { color, type, cut, occasion }
    });

  } catch (error: any) {
    console.error("🔥 SERPER KRYTYCZNY BŁĄD:", error.message);
    // Jeśli nawet fallback zawiedzie
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
