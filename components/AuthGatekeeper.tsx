'use client';

import { useState, useEffect, ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsLoading(false);
            setIsSigningIn(false);
        });
        return () => unsubscribe();
    }, []);

    const handleGoogleLogin = async () => {
        setIsSigningIn(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            console.error('Login error:', err);
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Zamknięto okno logowania. Spróbuj ponownie.');
            } else {
                setError('Nie udało się zalogować. Spróbuj ponownie.');
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

    // GATEKEEPER: Brak zalogowanego użytkownika → BLOKADA CAŁEJ APLIKACJI
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
                            Wirtualna przymierzalnia AI z ochroną prywatności.
                            Zaloguj się, by uzyskać dostęp do skanera sylwetki i inteligentnej przymiarki.
                        </p>

                        {/* GŁÓWNY PRZYCISK LOGOWANIA */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isSigningIn}
                            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-4 px-8 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5 disabled:opacity-60 disabled:cursor-wait text-lg"
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

                        {/* Błąd */}
                        {error && (
                            <p className="mt-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                                {error}
                            </p>
                        )}

                        {/* Podpis */}
                        <p className="mt-8 text-slate-600 text-xs">
                            Twoje zdjęcia są automatycznie usuwane po przymiarce (RODO).
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ZALOGOWANY → Renderuj całą aplikację
    return <>{children}</>;
}
