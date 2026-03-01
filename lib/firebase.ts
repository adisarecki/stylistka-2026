import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Diagnostyka – logowanie do konsoli (bezpieczne, nie ujawnia pełnych kluczy)
if (typeof window !== 'undefined') {
    console.log('[Firebase] Config check:', {
        apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'BRAK!',
        projectId: firebaseConfig.projectId || 'BRAK!',
        authDomain: firebaseConfig.authDomain || 'BRAK!',
    });
}

// Inicjalizacja z try-catch — błąd klucza NIE zabije całego buildu
let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;

try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
} catch (err: any) {
    console.error('[Firebase] KRYTYCZNY BŁĄD INICJALIZACJI:', err.message);
    console.error('[Firebase] Sprawdź zmienne NEXT_PUBLIC_FIREBASE_* w .env.local i w panelu Vercel.');
    console.error('[Firebase] Upewnij się, że klucze NIE mają cudzysłowów w panelu Vercel!');

    // Fallback: tworzymy pustą aplikację żeby build nie padł
    // Funkcje Firebase nie zadziałają, ale aplikacja się załaduje i pokaże błąd użytkownikowi
    app = !getApps().length ? initializeApp({ apiKey: 'invalid', projectId: 'invalid' }) : getApp();
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
}

export { app, db, storage, auth };
