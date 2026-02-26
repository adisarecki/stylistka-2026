'use client';

import { useState, useEffect } from 'react';
import { MapPin, Check, X, Loader2 } from 'lucide-react';
import { useLocation } from './LocationContext';

export default function LocationHeader() {
    const { location, setLocation, autoLocate, isLocating } = useLocation();
    const [isEditing, setIsEditing] = useState(false);
    const [tempLocation, setTempLocation] = useState(location);

    useEffect(() => {
        setTempLocation(location);
    }, [location]);

    const handleSave = () => {
        setLocation(tempLocation || 'Będzin / Śląsk');
        setIsEditing(false);
    };

    const handleGPS = async () => {
        await autoLocate();
        setIsEditing(false);
    };

    return (
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-50">
            {!isEditing ? (
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-full text-gray-700 text-sm font-medium transition-all shadow-sm hover:shadow-md"
                    disabled={isLocating}
                >
                    {isLocating ? <Loader2 size={16} className="text-indigo-500 animate-spin" /> : <MapPin size={16} className="text-indigo-500" />}
                    <span>{location}</span>
                </button>
            ) : (
                <div className="absolute right-0 top-0 bg-white border border-gray-200 p-4 rounded-2xl shadow-xl flex flex-col gap-3 min-w-[250px] animate-fade-in-up origin-top-right">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-gray-800">Twoja lokalizacja</span>
                        <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    <input
                        type="text"
                        className="w-full bg-gray-50 text-gray-800 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                        value={tempLocation}
                        onChange={(e) => setTempLocation(e.target.value)}
                        placeholder="Wpisz miasto..."
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleGPS}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1 font-medium"
                        >
                            <MapPin size={12} /> Użyj GPS
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1 font-medium"
                        >
                            <Check size={12} /> Zapisz
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
