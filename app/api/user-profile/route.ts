import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
        const { userId, zalandoSize, chestCm } = await request.json();

        if (!userId || (!zalandoSize && !chestCm)) {
            return NextResponse.json({ error: 'Brak wymaganych danych do utworzenia profilu.' }, { status: 400 });
        }

        // ZADANIE 4: Zapisywanie Skali Zalando w Profilu Użytkownika Firestore
        const userRef = db.collection('users').doc(userId);

        // Używamy set z parametrem merge, aby aktualizować tylko te pola bez nadpisywania całego dokumentu
        await userRef.set({
            lastActive: new Date().toISOString(),
            ...(zalandoSize && { savedZalandoSize: zalandoSize }),
            ...(chestCm && { savedChestCm: chestCm }),
        }, { merge: true });

        return NextResponse.json({ success: true, message: 'Zalando Profile zaktualizowany' });
    } catch (error) {
        console.error('Błąd zapisu do Profilu Firestore:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
