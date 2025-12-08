import { Infinity } from "lucide-react"

export function TopHUD() {
  return (
    <header className="fixed top-0 right-0 z-10 p-4 pt-[calc(env(safe-area-inset-top,12px)+8px)]">
      <button className="group relative active:scale-95 transition-transform">
        <div className="absolute inset-0 rounded-full bg-white/20 blur-md opacity-0 group-hover:opacity-40 transition-opacity" />
        <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
          <Infinity className="h-5 w-5 text-white/90 group-hover:text-white transition-colors" />
        </div>
      </button>
    </header>
  )
}
