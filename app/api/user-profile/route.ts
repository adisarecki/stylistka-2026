import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    const authResult = await requireAuthenticatedUser(request);
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

    const { uid } = authResult.user;

    try {
        const body = await request.json();
        const { zalandoSize, chestCm } = body;

        if (!zalandoSize && !chestCm) {
            return NextResponse.json(
                { error: 'Brak wymaganych danych do utworzenia profilu.' },
                { status: 400 }
            );
        }

        const adminDb = getAdminFirestore();
        const userRef = adminDb.collection('users').doc(uid);

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
