'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import Link from 'next/link';
import { LogIn, LogOut, Loader2, Sparkles } from 'lucide-react';

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
    } catch (err: unknown) {
      console.error('Auth error:', err);
      setError('Nie udało się zalogować. Spróbuj ponownie.');
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="w-full bg-[#FAF7F2]/90 backdrop-blur border-b border-[#EAE3D9] sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Logo / Link do Home */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
          <Sparkles className="text-[#83223A]" size={18} />
          <span className="text-[#242220] font-bold text-base tracking-tight">
            Stylistka <span className="text-[#83223A]">2026</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider bg-[#FBEFF2] text-[#83223A] border border-[#E8D5DA] px-2 py-0.5 rounded-full ml-1">
            Studio
          </span>
        </Link>

        {/* Auth Status */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Loader2 className="animate-spin text-[#8F867D]" size={18} />
          ) : user ? (
            // Zalogowany
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#F4EFEB] border border-[#EAE3D9] text-[#242220] px-2.5 py-1 rounded-full text-xs font-medium">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#83223A] text-white text-[9px] flex items-center justify-center font-bold">
                    {(user.displayName || 'U')[0]}
                  </div>
                )}
                <span className="max-w-[110px] truncate">{user.displayName || user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-[#6B645C] hover:text-[#83223A] text-xs font-semibold transition-colors"
                title="Wyloguj się"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Wyloguj</span>
              </button>
            </div>
          ) : (
            // Niezalogowany
            <div className="flex items-center gap-2">
              <button
                onClick={handleGoogleLogin}
                disabled={isSigningIn}
                className="flex items-center gap-1.5 bg-[#83223A] hover:bg-[#6D1B2F] text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-sm disabled:opacity-60"
              >
                {isSigningIn ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <LogIn size={14} />
                )}
                <span>{isSigningIn ? 'Logowanie...' : 'Zaloguj z Google'}</span>
              </button>
              {error && (
                <span className="text-[#9E1C38] text-[10px] max-w-[120px] truncate" title={error}>
                  {error}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
