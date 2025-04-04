import MusicProcessor from "@/components/music-processor"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-violet-800 to-indigo-900 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl"></div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <header className="mb-12 text-center">
          <div className="inline-block mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-violet-500 blur-lg opacity-50 rounded-full"></div>
              <h1 className="relative text-5xl font-bold text-white mb-2 tracking-tight px-6 py-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300">
                  Musico 777
                </span>
              </h1>
            </div>
          </div>
          <p className="text-purple-200 opacity-80 text-lg">Transform your music with premium audio effects</p>
        </header>
        <MusicProcessor />

        <footer className="mt-12 text-center">
          <div className="inline-block rounded-full px-6 py-2 bg-black/20 backdrop-blur-sm border border-purple-500/20">
            <p className="text-purple-200 text-sm">
              Developed by{" "}
              <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-pink-300 to-purple-300">
                Wahab Khan
              </span>
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}

