'use client';

import { useState, useEffect, ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, Loader2, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react';

interface AuthGatekeeperProps {
    children: ReactNode;
}

/**
 * AuthGatekeeper – PEŁNOEKRANOWA BLOKADA
 * 
 * Dopóki użytkownik nie zaloguje się przez Google,
 * ŻADEN komponent dziecka (TryOnWidget, karuzela, etc.) NIE zostaje zamontowany w DOM.
 * To gwarantuje zerowe requesty do API przed autoryzacją.
 */
export default function AuthGatekeeper({ children }: AuthGatekeeperProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [firebaseReady, setFirebaseReady] = useState(false);

    useEffect(() => {
        console.log('[AuthGatekeeper] Montowanie komponentu...');
        console.log('[AuthGatekeeper] Firebase auth object:', auth ? 'EXISTS' : 'NULL');

        try {
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                console.log('[AuthGatekeeper] onAuthStateChanged:', currentUser ? currentUser.email : 'BRAK USERA');
                setUser(currentUser);
                setIsLoading(false);
                setIsSigningIn(false);
                setFirebaseReady(true);
            });
            return () => unsubscribe();
        } catch (err: any) {
            console.error('[AuthGatekeeper] Firebase init error:', err);
            setIsLoading(false);
            setFirebaseReady(false);
            setError('Błąd inicjalizacji Firebase: ' + err.message);
        }
    }, []);

    const handleGoogleLogin = async () => {
        console.log('[AuthGatekeeper] Kliknięto przycisk logowania Google');
        setIsSigningIn(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            console.log('[AuthGatekeeper] Wywołuję signInWithPopup...');
            const result = await signInWithPopup(auth, provider);
            console.log('[AuthGatekeeper] Zalogowano pomyślnie:', result.user.email);
        } catch (err: any) {
            console.error('[AuthGatekeeper] Login error:', err.code, err.message);
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Zamknięto okno logowania. Spróbuj ponownie.');
            } else if (err.code === 'auth/unauthorized-domain') {
                setError('Domena nie jest autoryzowana w Firebase Console. Dodaj ją do Authorized Domains w Authentication → Settings.');
            } else if (err.code === 'auth/popup-blocked') {
                setError('Przeglądarka zablokowała okno popup. Odblokuj popupy dla tej strony.');
            } else {
                setError(`Błąd logowania (${err.code || 'unknown'}): ${err.message}`);
            }
            setIsSigningIn(false);
        }
    };

    // Stan ładowania Firebase Auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                <p className="text-slate-400 font-medium">Łączenie z bazą prywatności...</p>
            </div>
        );
    }

    // GATEKEEPER: Brak zalogowanego użytkownika → ekran logowania z AKTYWNYM przyciskiem Google
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
                <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-10 shadow-[0_0_80px_rgba(99,102,241,0.08)] text-center relative overflow-hidden">
                    {/* Dekoracja */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 pointer-events-none" />

                    <div className="relative z-10">
                        {/* Ikona */}
                        <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(99,102,241,0.15)]">
                            <ShieldCheck size={48} className="text-indigo-400" />
                        </div>

                        {/* Logo */}
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Sparkles className="text-indigo-400" size={24} />
                            <h1 className="text-3xl font-bold text-white tracking-tight">
                                Stylistka <span className="text-indigo-400">2026</span>
                            </h1>
                        </div>

                        {/* Opis */}
                        <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                            Wirtualna przymierzalnia AI ze skanowaniem sylwetki i automatyczną ochroną prywatności.
                            Zaloguj się, aby wejść do Przymierzalni AI.
                        </p>

                        {/* ========== GŁÓWNY PRZYCISK LOGOWANIA ========== */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isSigningIn}
                            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-4 px-8 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5 disabled:opacity-60 disabled:cursor-wait text-lg border-2 border-transparent hover:border-indigo-300"
                        >
                            {isSigningIn ? (
                                <>
                                    <Loader2 className="animate-spin" size={22} />
                                    Logowanie...
                                </>
                            ) : (
                                <>
                                    <LogIn size={22} />
                                    Zaloguj się z Google
                                </>
                            )}
                        </button>

                        {/* Błąd - wyraźny, z ikoną */}
                        {error && (
                            <div className="mt-4 flex items-start gap-2 text-left bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                <AlertTriangle className="shrink-0 text-red-400 mt-0.5" size={16} />
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Status Firebase */}
                        <div className="mt-8 flex items-center justify-center gap-2 text-xs">
                            <div className={`w-2 h-2 rounded-full ${firebaseReady ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className="text-slate-600">
                                Firebase: {firebaseReady ? 'Połączony' : 'Rozłączony'}
                            </span>
                        </div>

                        <p className="mt-2 text-slate-600 text-xs">
                            Twoje zdjęcia są automatycznie usuwane po przymiarce (RODO).
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ZALOGOWANY → Dopiero teraz montuj całą aplikację
    console.log('[AuthGatekeeper] Użytkownik zalogowany, montowanie aplikacji...');
    return <>{children}</>;
}
