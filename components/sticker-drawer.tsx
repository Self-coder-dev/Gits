"use client"

import { useState } from "react"

const stickers = [
  { id: 1, query: "funny meme face emoji" },
  { id: 2, query: "fire flame emoji" },
  { id: 3, query: "laughing crying emoji" },
  { id: 4, query: "sunglasses cool emoji" },
  { id: 5, query: "heart love emoji" },
  { id: 6, query: "star sparkle emoji" },
  { id: 7, query: "skull emoji" },
  { id: 8, query: "rainbow emoji" },
]

export function StickerDrawer() {
  const [selectedSticker, setSelectedSticker] = useState<number | null>(null)

  return (
    <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 p-3">
      <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1 px-1">
        {stickers.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => setSelectedSticker(sticker.id)}
            className={`relative flex-shrink-0 h-[60px] w-[60px] rounded-full overflow-hidden transition-all duration-200 active:scale-95 ${
              selectedSticker === sticker.id
                ? "ring-2 ring-white ring-offset-2 ring-offset-black/50 scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                : "border-2 border-white/20 hover:border-white/40"
            }`}
          >
            <img
              src="https://placehold.co/60x60/png"
              alt={`Sticker ${sticker.id}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
