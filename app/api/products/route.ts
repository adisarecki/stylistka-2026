import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth-server';
import { normalizeSerperImages } from '@/lib/product-normalizer';
import {
  DEFAULT_MARKET_CODE,
  getMarketProfile,
  getMarketSearchDomains,
  isSupportedMarketCode,
  buildMarketSiteFilter,
} from '@/lib/market-config';

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const size = searchParams.get('size');

  const color = searchParams.get('color');
  const type = searchParams.get('type');
  const cut = searchParams.get('cut');
  const occasion = searchParams.get('occasion');

  // Walidacja i normalizacja parametru rynku
  const rawMarket = searchParams.get('market');
  let marketCode = DEFAULT_MARKET_CODE;

  if (rawMarket !== null) {
    const normalized = rawMarket.trim().toUpperCase();
    if (!isSupportedMarketCode(normalized)) {
      return NextResponse.json(
        {
          error: 'UNSUPPORTED_MARKET',
          message: `Rynek "${rawMarket}" nie jest obecnie obsługiwany.`,
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }
    marketCode = normalized;
  }

  const marketProfile = getMarketProfile(marketCode);
  if (!marketProfile) {
    return NextResponse.json(
      {
        error: 'UNSUPPORTED_MARKET',
        message: 'Nieprawidłowa konfiguracja rynku.',
      },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

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

    const searchDomains = getMarketSearchDomains(marketCode);
    if (!searchDomains || searchDomains.length === 0) {
      return NextResponse.json(
        {
          error: 'UNSUPPORTED_MARKET',
          message: `Brak skonfigurowanych domen dla rynku "${marketCode}".`,
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }
    const siteFilter = buildMarketSiteFilter(searchDomains);

    const callSerper = async (searchQuery: string) => {
      // Każde zapytanie Serper bezwzględnie musi zawierać filtr domen rynku
      const finalQuery = `${searchQuery} ${siteFilter}`;

      console.log('-> Serper Request Q:', finalQuery);

      const resp = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: finalQuery,
          num: 10,
          gl: marketProfile.serperGl,
          hl: marketProfile.serperHl,
        })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(`Serper API Error: ${resp.status} - ${JSON.stringify(errData)}`);
      }
      return await resp.json();
    };

    let data;
    let isAlternative = false;

    // Próba 1: Pełne parametryczne zapytanie z wymuszeniem packshotu i rozmiarem (jeśli dostępny)
    try {
      let q1: string;
      if (color && type) {
        const cutPart = cut ? ` +${cut}` : '';
        const sizePart = size ? ` +intext:"${size}"` : '';
        q1 = `+${color} +${type}${cutPart}${sizePart} +packshot +"białe tło" -portfolio -fotograf -usługi -sesja -buty -torebka -szpilki -modelka -editorial`;
      } else {
        q1 = `"${query}" +packshot +"białe tło" -portfolio -fotograf -sesja -fotografia -usługi -modelka`;
      }

      data = await callSerper(q1);

      if (!data.images || data.images.length === 0) {
        throw new Error("Pusta lista wyników (Próba 1)");
      }
    } catch {
      // Próba 2: Poluzowane zapytanie (bez rozmiaru, ale z packshotem i siteFilter)
      console.log('⚠️ BRAK WYNIKÓW (Próba 1). Szukam bez rozmiaru, z wymuszeniem packshotu...');
      try {
        let q2: string;
        if (color && type) {
          const cutPart = cut ? ` +${cut}` : '';
          q2 = `+${color} +${type}${cutPart} +packshot +"białe tło" -portfolio -fotograf -usługi -sesja -buty -torebka -szpilki -modelka -editorial`;
        } else {
          q2 = `"${q || ''}" +packshot +"białe tło" -portfolio -fotograf -sesja -fotografia -usługi -modelka`;
        }

        data = await callSerper(q2);
        isAlternative = true;
        if (!data.images || data.images.length === 0) {
          throw new Error("Pusta lista wyników (Próba 2)");
        }
      } catch {
        // Próba 3: Ostatnia próba rynkowa - czyste query użytkownika z zachowaniem siteFilter rynku
        console.log('⚠️ BRAK WYNIKÓW (Próba 2). Uruchamiam ostatnią próbę w ramach domen rynku...');
        try {
          const rawBase = q || query || '';
          data = await callSerper(`"${rawBase}"`);
          isAlternative = true;
          if (!data.images || data.images.length === 0) {
            data = { images: [] };
          }
        } catch {
          data = { images: [] };
        }
      }
    }

    // Mapowanie wyników Serper na format CanonicalProduct (jako inspiracja dla danego rynku)
    const products = normalizeSerperImages(data?.images, 12, marketProfile.marketCode);

    console.log(`✅ FINISZER (SERPER): Znaleziono ${products.length} produktów. Alternatywne: ${isAlternative}`);

    return NextResponse.json({
      products,
      isAlternative,
      generatedQuery: (color && type && !isAlternative) ? `+${color} +${type} ${cut ? `+${cut}` : ''} site:...` : query,
      garmentMetadata: { color, type, cut, occasion }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Błąd serwera wyszukiwarki";
    console.error("🔥 SERPER KRYTYCZNY BŁĄD:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
