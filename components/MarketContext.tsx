'use client';

import React, { createContext, useContext, useSyncExternalStore, ReactNode } from 'react';
import { MarketCode, MarketProfile } from '@/types/market';
import {
  DEFAULT_MARKET_CODE,
  POLAND_MARKET_PROFILE,
  ACTIVE_MARKETS,
  getMarketProfile,
  parseMarketCode,
} from '@/lib/market-config';

interface MarketContextType {
  market: MarketProfile;
  setMarketCode: (code: MarketCode) => void;
  activeMarkets: readonly MarketProfile[];
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'stylistka-market-code';
const CUSTOM_EVENT_KEY = 'stylistka-market-change';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(CUSTOM_EVENT_KEY, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CUSTOM_EVENT_KEY, callback);
  };
}

function getSnapshot(): MarketCode {
  if (typeof window === 'undefined') return DEFAULT_MARKET_CODE;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return parseMarketCode(stored) || DEFAULT_MARKET_CODE;
  } catch {
    return DEFAULT_MARKET_CODE;
  }
}

function getServerSnapshot(): MarketCode {
  return DEFAULT_MARKET_CODE;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const marketCode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMarketCode = (code: MarketCode) => {
    const profile = getMarketProfile(code);
    if (profile && typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, profile.marketCode);
        window.dispatchEvent(new Event(CUSTOM_EVENT_KEY));
      } catch {
        // Ignoruj błędy zapisu localStorage
      }
    }
  };

  const currentProfile = getMarketProfile(marketCode) || POLAND_MARKET_PROFILE;

  return (
    <MarketContext.Provider
      value={{
        market: currentProfile,
        setMarketCode,
        activeMarkets: ACTIVE_MARKETS,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket(): MarketContextType {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
