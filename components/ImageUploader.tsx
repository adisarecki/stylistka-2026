'use client';

import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';

interface ImageUploaderProps {
  label: string;
  image: string | null;
  onUpload: (file: File | null) => void;
}

export default function ImageUploader({ label, image, onUpload }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpload(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-gray-700">{label}</span>
      <div 
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center w-full h-64 
          border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${image ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'}
        `}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange}
        />

        {image ? (
          <div className="relative w-full h-full p-2">
            <Image 
              src={image} 
              alt={label} 
              fill 
              className="object-contain rounded-md" 
            />
            <button 
              onClick={handleClear}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-red-50 text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <Upload className="w-10 h-10 mb-2" />
            <p className="text-sm">Kliknij, aby wgrać zdjęcie</p>
          </div>
        )}
      </div>
    </div>
  );
}
