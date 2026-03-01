import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, Analytics } from "firebase/analytics";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Klucze wpisane na twardo w celu obejścia problemów z SSR / Vercel Build (Zgodnie z poleceniem Wizjonera)
const firebaseConfig = {
    apiKey: "AIzaSyD64hkVf0Zam8W3qbg_-k-nRUwlOcgqx20",
    authDomain: "stylistka-2026-8082a.firebaseapp.com",
    projectId: "stylistka-2026-8082a",
    storageBucket: "stylistka-2026-8082a.firebasestorage.app",
    messagingSenderId: "903036072588",
    appId: "1:903036072588:web:6937f29d12fc6b7f1241a9",
    measurementId: "G-WSB2PXS67V"
};

// 1. Bezpieczna inicjalizacja (zapobiega błędom podczas Next.js build)
let app: FirebaseApp | undefined = undefined;

if (firebaseConfig.apiKey) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} else {
    console.warn("⚠️ Brak klucza Firebase. Pomijam inicjalizację.");
}

// 2. Eksport instancji usług
// Zapewniamy fallback w przypadku kompletnej porażki, aby SSR nie wyrzucał TypeError
const auth: Auth = app ? getAuth(app) : ({} as Auth);
const db: Firestore = app ? getFirestore(app) : ({} as Firestore);
const storage: FirebaseStorage = app ? getStorage(app) : ({} as FirebaseStorage);

// 3. Bezpieczne ładowanie analityki (tylko w przeglądarce, omija błąd window is not defined)
let analytics: Analytics | null = null;
if (app && typeof window !== "undefined") {
    isSupported().then((supported) => {
        if (supported && app) {
            analytics = getAnalytics(app);
        }
    });
}

export { app, auth, db, storage, analytics };
