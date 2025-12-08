"use client"

import { useState } from "react"
import { X, Sparkles } from "lucide-react"

interface TextInputOverlayProps {
  isOpen: boolean
  onClose: () => void
}

const fontStyles = [
  { id: "classic", label: "Classic Meme", className: "font-bold uppercase" },
  { id: "neon", label: "Neon", className: "font-bold italic text-cyan-400" },
  { id: "handwritten", label: "Handwritten", className: "font-serif italic" },
]

export function TextInputOverlay({ isOpen, onClose }: TextInputOverlayProps) {
  const [prompt, setPrompt] = useState("")
  const [selectedFont, setSelectedFont] = useState("classic")

  if (!isOpen) return null

  const handleGenerate = () => {
    if (prompt.trim()) {
      console.log("Generating sticker:", prompt, "with font:", selectedFont)
      setPrompt("")
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/80">
      {/* Clickable backdrop area */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal - Glassmorphism styling */}
      <div className="relative w-full max-w-sm bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">Text to AR</h2>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="POV: You are..."
              className="w-full px-4 py-4 rounded-xl bg-black/70 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-black/80 transition-all text-base"
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-white/50 uppercase tracking-wider">Font Style</p>
            <div className="flex gap-2">
              {fontStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedFont(style.id)}
                  className={`flex-1 py-3 px-2 rounded-xl border text-xs transition-all duration-200 ${
                    selectedFont === style.id
                      ? "bg-white/15 border-white/40 text-white"
                      : "bg-black/40 border-white/10 text-white/60 hover:bg-white/5 hover:border-white/20"
                  }`}
                >
                  <span className={style.className}>{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="w-full py-4 rounded-xl font-bold text-base tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 hover:shadow-[0_0_30px_rgba(251,191,36,0.3)] active:scale-[0.98]"
          >
            Generate Sticker
          </button>
        </div>
      </div>
    </div>
  )
}
