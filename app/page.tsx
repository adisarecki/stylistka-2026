import TryOnWidget from "@/components/TryOnWidget";
import LocationHeader from "@/components/LocationHeader";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <LocationHeader />
      <div className="max-w-5xl mx-auto mt-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
            Stylistka <span className="text-indigo-600">2026</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Wirtualna przymierzalnia napędzana przez AI.
          </p>
        </header>

        <TryOnWidget />
      </div>
    </main>
  );
}
