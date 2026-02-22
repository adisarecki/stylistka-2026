'use client';

import { Loader2, Download } from 'lucide-react';
import Image from 'next/image';
import { TryOnStatus } from '@/types';

interface ResultViewerProps {
  image: string | null;
  status: TryOnStatus;
  error?: string | null;
}

export default function ResultViewer({ image, status, error }: ResultViewerProps) {
  return (
    <div className="mt-8 p-6 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col items-center justify-center">
      {status === 'loading' && (
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">AI generuje przymiarkę...</p>
        </div>
      )}

      {status === 'success' && typeof image === 'string' && image.trim().length > 0 && (
        <div className="w-full h-full flex flex-col items-center gap-4">
          <div className="relative w-full h-[500px]">
            <Image 
              src={image} 
              alt="Wynik przymiarki" 
              fill 
              className="object-contain rounded-lg shadow-md"
              unoptimized
            />
          </div>
          <a 
            href={image} 
            download="stylistka-result.png"
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <Download size={20} />
            Pobierz Wynik
          </a>
        </div>
      )}

      {status === 'idle' && (
        <div className="text-center text-gray-400">
          <p className="text-lg">Tutaj pojawi się wynik</p>
          <p className="text-sm">Wgraj zdjęcia i kliknij "PRZYMIERZ (AI)"</p>
        </div>
      )}
      
      {status === 'error' && (
         <div className="text-center text-red-500">
          <p className="text-lg font-bold">Wystąpił błąd</p>
          <p className="text-sm">{error || "Spróbuj ponownie później."}</p>
        </div>
      )}
    </div>
  );
}
