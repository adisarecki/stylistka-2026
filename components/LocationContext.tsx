'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LocationContextType {
  location: string;
  setLocation: (loc: string) => void;
  autoLocate: () => Promise<void>;
  isLocating: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<string>('Lokalizowanie...');
  const [isLocating, setIsLocating] = useState<boolean>(true);

  const setLocation = (loc: string) => {
    setLocationState(loc);
    if (typeof window !== 'undefined') {
      localStorage.setItem('userLocation', loc);
    }
  };

  const autoLocate = async () => {
    setIsLocating(true);

    const fallbackIP = async () => {
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await res.json();
        if (data.city) {
          setLocation(`${data.city} (wg IP)`);
        } else {
          setLocation('Będzin / Śląsk');
        }
      } catch (e) {
        setLocation('Będzin / Śląsk');
      } finally {
        setIsLocating(false);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=pl`);
            const data = await res.json();
            if (data.city) {
              setLocation(`${data.city} (GPS)`);
            } else {
              await fallbackIP();
            }
          } catch (e) {
            await fallbackIP();
          } finally {
            setIsLocating(false);
          }
        },
        async (error) => {
          await fallbackIP();
        },
        { timeout: 7000 }
      );
    } else {
      await fallbackIP();
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('userLocation');
    if (stored) {
      setLocationState(stored);
      setIsLocating(false);
      return;
    }
    autoLocate();
  }, []);

  return (
    <LocationContext.Provider value={{ location, setLocation, autoLocate, isLocating }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
