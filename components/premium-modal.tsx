"use client"

import { Crown, X, Check } from "lucide-react"

interface PremiumModalProps {
  isOpen: boolean
  onClose: () => void
}

const benefits = [
  "Remove Watermark",
  "4K Video Recording",
  "Cloud Save",
  "Priority Support",
]

export function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative bg-gradient-to-b from-neutral-900 to-black border border-white/10 rounded-3xl p-8 w-full max-w-sm mx-4 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-all text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Crown Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-600/20 border border-yellow-500/30">
            <Crown className="w-12 h-12 text-yellow-400 drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 12px rgba(250, 204, 21, 0.5))' }} />
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          Upgrade to Pro
        </h2>

        {/* Coming Soon Badge */}
        <p className="text-yellow-400/80 text-center text-xs font-medium tracking-wide uppercase mb-6">
          Coming Soon
        </p>

        {/* Benefits List */}
        <ul className="space-y-3 mb-8">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-400/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-yellow-400" />
              </div>
              <span className="text-white/80 text-sm">{benefit}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <button
          onClick={onClose}
          className="w-full px-6 py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 rounded-xl text-black font-bold transition-all active:scale-[0.98] shadow-lg shadow-yellow-500/25"
        >
          Join Waitlist
        </button>
      </div>
    </div>
  )
}
