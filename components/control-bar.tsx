"use client"

import { useState } from "react"
import { RefreshCcw, Sparkles } from "lucide-react"

interface ControlBarProps {
  onTextClick: () => void
  onStickersClick: () => void
  showStickers: boolean
}

export function ControlBar({ onTextClick, onStickersClick, showStickers }: ControlBarProps) {
  const [isRecording, setIsRecording] = useState(false)

  return (
    <div className="flex items-center justify-center gap-6">
      {/* Far Left: Sticker Icon (Small, Ghost) */}
      <button
        onClick={onStickersClick}
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
          showStickers ? "text-white" : "text-white/70 hover:text-white"
        }`}
      >
        <div
          className={`h-11 w-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all duration-200 ${
            showStickers
              ? "bg-white/20 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.3)]"
              : "bg-black/30 border-white/10 hover:bg-white/10"
          }`}
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-medium">Stickers</span>
      </button>

      {/* Center-Left: Photo Shutter Button (Solid White Circle, 48px) */}
      <button
        onClick={() => console.log("Photo captured")}
        className="flex flex-col items-center gap-1 text-white active:scale-95 transition-all"
      >
        <div className="h-12 w-12 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center hover:bg-white/90 active:bg-white/80 transition-colors" />
        <span className="text-[10px] font-medium text-white/70">Photo</span>
      </button>

      {/* Center-Right: Video Record Button (Red Ring, 64px) */}
      <button onClick={() => setIsRecording(!isRecording)} className="flex flex-col items-center gap-1">
        <div className="relative h-16 w-16 rounded-full border-[3px] border-red-500 flex items-center justify-center bg-black/40 backdrop-blur-sm shadow-[0_0_20px_rgba(239,68,68,0.4)]">
          <div
            className={`bg-red-500 transition-all duration-200 ${
              isRecording ? "h-5 w-5 rounded-sm" : "h-10 w-10 rounded-full"
            }`}
          />
        </div>
        <span className="text-[10px] font-medium text-white/70">{isRecording ? "Stop" : "Record"}</span>
      </button>

      {/* Far Right: Flip Camera Icon (Small, Ghost) */}
      <button className="flex flex-col items-center gap-1 text-white/70 hover:text-white active:scale-95 transition-all">
        <div className="h-11 w-11 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
          <RefreshCcw className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-medium">Flip</span>
      </button>
    </div>
  )
}
