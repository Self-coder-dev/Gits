"use client"

import { ImagePlus, Move3d, Hand, Trash2, Camera, Play, Type } from "lucide-react"

interface BottomDockProps {
  setActiveSticker: (sticker: string | null) => void
  onAddClick: () => void
  onTextClick: () => void
  onCameraClick: () => void
  onRecordClick: () => void
  isRecording: boolean
  isSnapEnabled: boolean
  setIsSnapEnabled: (enabled: boolean) => void
  isEditMode: boolean
  setIsEditMode: (enabled: boolean) => void
}

export function BottomDock({ setActiveSticker, onAddClick, onTextClick, onCameraClick, onRecordClick, isRecording, isSnapEnabled, setIsSnapEnabled, isEditMode, setIsEditMode }: BottomDockProps) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      {/* Floating Glass Capsule HUD */}
      <div className="flex items-center gap-6 px-6 py-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl transition-all duration-300 hover:shadow-white/5">
        
        {/* Group 1: Assets */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onAddClick}
            className="text-white/80 hover:text-white hover:scale-110 transition-all duration-200 active:scale-95"
            aria-label="Upload image"
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          <button 
            onClick={onTextClick}
            className="text-white/80 hover:text-white hover:scale-110 transition-all duration-200 active:scale-95"
            aria-label="Add text"
          >
            <Type className="w-5 h-5" />
          </button>
        </div>

        {/* Divider 1 */}
        <div className="h-8 w-px bg-white/20"></div>

        {/* Group 2: Capture (Core Actions) */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onCameraClick}
            className="relative text-white/80 hover:text-white hover:scale-110 transition-all duration-200 active:scale-95"
            aria-label="Take photo"
          >
            <div className="absolute inset-0 bg-white/10 blur-xl rounded-full opacity-0 hover:opacity-100 transition-opacity"></div>
            <Camera className="w-8 h-8 relative z-10" />
          </button>

          <button 
            onClick={onRecordClick}
            className={`relative hover:scale-110 transition-all duration-200 active:scale-95 ${
              isRecording ? "text-red-500 animate-pulse" : "text-white/80 hover:text-white"
            }`}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            <div className={`absolute inset-0 blur-xl rounded-full transition-opacity ${
              isRecording ? "bg-red-500/20 opacity-100" : "bg-white/10 opacity-0 hover:opacity-100"
            }`}></div>
            <Play className="w-8 h-8 relative z-10" />
          </button>
        </div>

        {/* Divider 2 */}
        <div className="h-8 w-px bg-white/20"></div>

        {/* Group 3: Tools */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`rounded-full transition-all duration-200 active:scale-95 ${
              isEditMode 
                ? "bg-white text-black p-2" 
                : "text-white/80 hover:text-white hover:scale-110"
            }`}
            aria-label="Toggle edit mode"
          >
            <Move3d className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsSnapEnabled(!isSnapEnabled)}
            className={`rounded-full transition-all duration-200 active:scale-95 ${
              isSnapEnabled 
                ? "bg-white text-black p-2" 
                : "text-white/80 hover:text-white hover:scale-110"
            }`}
            aria-label="Toggle snap mode"
          >
            <Hand className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setActiveSticker(null)}
            className="text-white/80 hover:text-red-500 hover:scale-110 transition-all duration-200 active:scale-95 relative group"
            aria-label="Clear sticker"
          >
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Trash2 className="w-5 h-5 relative z-10" />
          </button>
        </div>

      </div>
    </div>
  )
}
