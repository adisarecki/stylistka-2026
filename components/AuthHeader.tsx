'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { LogIn, LogOut, ShieldCheck, Loader2, Sparkles } from 'lucide-react';

export default function AuthHeader() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsLoading(false);
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
            console.error('Auth error:', err);
            setError('Nie udało się zalogować. Spróbuj ponownie.');
            setIsSigningIn(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    return (
        <div className="w-full bg-slate-900/80 backdrop-blur border-b border-white/5 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <Sparkles className="text-indigo-400" size={20} />
                    <span className="text-white font-bold text-lg tracking-tight">
                        Stylistka <span className="text-indigo-400">2026</span>
                    </span>
                </div>

                {/* Auth Status */}
                <div className="flex items-center gap-3">
                    {isLoading ? (
                        <Loader2 className="animate-spin text-slate-400" size={20} />
                    ) : user ? (
                        // Zalogowany
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full text-sm font-medium">
                                <ShieldCheck size={14} className="text-emerald-400" />
                                <img
                                    src={user.photoURL || ''}
                                    alt={user.displayName || 'User'}
                                    className="w-5 h-5 rounded-full"
                                />
                                <span className="max-w-[120px] truncate">{user.displayName}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 text-sm font-medium transition-colors"
                            >
                                <LogOut size={15} />
                                Wyloguj
                            </button>
                        </div>
                    ) : (
                        // Niezalogowany – GŁÓWNY PRZYCISK
                        <div className="flex flex-col items-end gap-1">
                            <button
                                onClick={handleGoogleLogin}
                                disabled={isSigningIn}
                                className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-white/10 disabled:opacity-60 disabled:cursor-wait"
                            >
                                {isSigningIn ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <LogIn size={18} />
                                )}
                                {isSigningIn ? 'Logowanie...' : 'Zaloguj przez Google'}
                            </button>
                            {error && (
                                <p className="text-red-400 text-xs">{error}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
