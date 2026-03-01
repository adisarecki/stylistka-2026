import TryOnWidget from "@/components/TryOnWidget";
import LocationHeader from "@/components/LocationHeader";
import AuthHeader from "@/components/AuthHeader";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      {/* ZADANIE 1: Widoczny przycisk Google Auth – sticky na górze każdej strony */}
      <AuthHeader />

      <LocationHeader />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <TryOnWidget />
      </div>
    </main>
  );
}
