"use client"

import { useState, useRef, useEffect } from "react"
import Webcam from "react-webcam"
import { TopHUD } from "./top-hud"
import { BottomDock } from "./bottom-dock"
import { TextInputOverlay } from "./text-input-overlay"
import { User, X, Download, Trash2 } from "lucide-react"
import { useMediaPipe } from "@/hooks/useMediaPipe"

export function ARCameraInterface() {
  const [showTextInput, setShowTextInput] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showTextModal, setShowTextModal] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [activeSticker, setActiveSticker] = useState<string | null>(null)
  const [isSnapEnabled, setIsSnapEnabled] = useState(false)  // Changed default to false
  const [isEditMode, setIsEditMode] = useState(false)
  const [manualScale, setManualScale] = useState(1)
  const [manualRotation, setManualRotation] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  // Video recording states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null)
  const webcamRef = useRef<Webcam>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Get video element from webcam ref and sync canvas size
  useEffect(() => {
    if (webcamRef.current && webcamRef.current.video) {
      videoRef.current = webcamRef.current.video
      
      // Sync canvas size with video
      const video = webcamRef.current.video
      const canvas = canvasRef.current
      
      if (canvas) {
        const syncSize = () => {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        
        // Sync once video metadata is loaded
        video.addEventListener("loadedmetadata", syncSize)
        
        // Also sync on play in case metadata was already loaded
        if (video.videoWidth > 0) {
          syncSize()
        }
        
        return () => {
          video.removeEventListener("loadedmetadata", syncSize)
        }
      }
    }
  }, [])

  // Initialize MediaPipe with active sticker, snap enabled state, and manual adjustments
  const { isReady } = useMediaPipe(videoRef, canvasRef, activeSticker, isSnapEnabled, manualScale, manualRotation)

  // Countdown timer logic
  useEffect(() => {
    if (countdown === null) return
    
    if (countdown === 0) {
      // Capture the photo
      handleCapturePhoto()
      return
    }

    // Decrement countdown every second
    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  // Recording timer logic with 10s auto-stop
  useEffect(() => {
    if (!isRecording) {
      setRecordingTime(0)
      return
    }

    // Auto-stop at 10 seconds
    if (recordingTime >= 10) {
      handleStopRecording()
      return
    }

    // Increment timer every second
    const timer = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isRecording, recordingTime])

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Create a temporary blob URL for the selected image
      const blobUrl = URL.createObjectURL(file)
      setActiveSticker(blobUrl)
      console.log("✅ User uploaded image:", file.name)
    }
  }

  // Trigger file input when Add button is clicked
  const handleAddClick = () => {
    fileInputRef.current?.click()
  }

  // Open text modal
  const handleTextClick = () => {
    setShowTextModal(true)
    setTextInput("")
  }

  // Generate text sticker
  const handleGenerateText = () => {
    if (!textInput.trim()) return

    // Create temporary canvas
    const canvas = document.createElement("canvas")
    canvas.width = 500
    canvas.height = 300
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // FIX 2: Use clearRect for 100% transparent background (NO fillRect!)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set text properties (Avenir Next font, heavy weight)
    ctx.font = '900 60px "Avenir Next", sans-serif'
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // FIX: Pre-mirror the text so it looks correct in AR mirror
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)  // Flip horizontally

    // Draw heavy black outline (stroke) for readability
    ctx.strokeStyle = "black"
    ctx.lineWidth = 10  // Increased from 8 to 10 for better readability
    ctx.strokeText(textInput.toUpperCase(), canvas.width / 2, canvas.height / 2)

    // Draw white text fill
    ctx.fillStyle = "white"
    ctx.fillText(textInput.toUpperCase(), canvas.width / 2, canvas.height / 2)

    // Restore canvas state
    ctx.restore()

    // Convert to data URL
    const dataUrl = canvas.toDataURL("image/png")
    setActiveSticker(dataUrl)
    setShowTextModal(false)
    console.log("✅ Text sticker generated:", textInput)
  }

  // Start countdown when camera button is clicked
  const handleCameraClick = () => {
    setCountdown(3)
  }

  // Capture photo from canvas - FIXED for black background
  const handleCapturePhoto = () => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    // CRITICAL FIX: Draw video frame BEHIND existing stickers/overlays
    ctx.globalCompositeOperation = 'destination-over'
    
    // Save context state
    ctx.save()
    
    // Mirror the video to match the display
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)
    
    // Draw the current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Restore context
    ctx.restore()
    
    // Reset composite operation to normal
    ctx.globalCompositeOperation = 'source-over'

    // Capture as JPEG with high quality
    const data = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedPhoto(data)
    setCountdown(null)
    console.log("📸 Photo captured with video background!")
  }

  // Start video recording
  const handleStartRecording = () => {
    if (!canvasRef.current || isRecording) return

    try {
      // Clear previous chunks
      chunksRef.current = []
      
      // Capture canvas stream at 30 FPS
      const stream = canvasRef.current.captureStream(30)
      
      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, { 
        mimeType: 'video/webm;codecs=vp9' 
      })
      
      // Collect data chunks
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }
      
      // Handle recording stop
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const videoUrl = URL.createObjectURL(blob)
        setRecordedVideo(videoUrl)
        console.log("🎥 Video recording complete!")
      }
      
      // Start recording
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)
      console.log("🔴 Recording started...")
    } catch (error) {
      console.error("❌ Failed to start recording:", error)
    }
  }

  // Stop video recording
  const handleStopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return

    mediaRecorderRef.current.stop()
    setIsRecording(false)
    console.log("⏹️ Recording stopped")
  }

  // Toggle recording (start/stop)
  const handleRecordClick = () => {
    if (isRecording) {
      handleStopRecording()
    } else {
      handleStartRecording()
    }
  }

  // Download captured media (photo or video)
  const handleDownload = () => {
    if (capturedPhoto) {
      const link = document.createElement('a')
      link.download = `stargaze-photo-${Date.now()}.jpg`
      link.href = capturedPhoto
      link.click()
      console.log("💾 Photo downloaded!")
    } else if (recordedVideo) {
      const link = document.createElement('a')
      link.download = `stargaze-video-${Date.now()}.webm`
      link.href = recordedVideo
      link.click()
      console.log("💾 Video downloaded!")
    }
  }

  // Close review modal
  const handleCloseReview = () => {
    setCapturedPhoto(null)
    setRecordedVideo(null)
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* Layer 0: Camera Feed Background */}
      <Webcam
        ref={webcamRef}
        audio={false}
        mirrored={true}
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
      />

      {/* Layer 1: Debug Canvas for Landmarks */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-[1]"
        style={{ pointerEvents: "none" }}
      />

      {/* Top Right Menu - User Profile */}
      <div className="fixed top-4 right-4 z-30">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="text-white hover:opacity-80 transition-opacity"
          style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))' }}
          aria-label="User menu"
        >
          <User className="w-6 h-6" />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute top-10 right-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden min-w-[180px] shadow-2xl">
            <div className="px-4 py-2 text-xs text-gray-400 border-b border-white/10">
              Guest User
            </div>
            <div className="px-4 py-2 text-sm text-white border-b border-white/10">
              Tier: Free
            </div>
            <button className="w-full px-4 py-3 text-sm text-white font-bold hover:bg-white/10 transition-all text-left">
              Unlock Pro 💎
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />

      {/* Bottom Control Deck */}
      <BottomDock 
        setActiveSticker={setActiveSticker} 
        onAddClick={handleAddClick} 
        onTextClick={handleTextClick}
        onCameraClick={handleCameraClick}
        onRecordClick={handleRecordClick}
        isRecording={isRecording}
        isSnapEnabled={isSnapEnabled}
        setIsSnapEnabled={setIsSnapEnabled}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
      />

      {/* Edit Mode Slider Panel */}
      {isEditMode && (
        <div className="fixed bottom-40 left-1/2 transform -translate-x-1/2 z-20 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
          <h3 className="text-white font-bold mb-4 text-center">Edit Sticker</h3>
          
          {/* Size Slider */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-white text-sm font-medium">Size</label>
              <span className="text-white/60 text-xs">{manualScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={manualScale}
              onChange={(e) => setManualScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Rotate Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-white text-sm font-medium">Rotate</label>
              <span className="text-white/60 text-xs">{manualRotation}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={manualRotation}
              onChange={(e) => setManualRotation(parseInt(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      )}

      {/* Premium Watermark - Safe Zone Positioning (TV Network Bug Style) */}
      <div className="absolute bottom-[5%] right-[5%] text-white/90 font-bold text-xl drop-shadow-md text-right z-50 pointer-events-none font-['Avenir_Next']">
        Made by Blue Ocean Tech
      </div>

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div 
            className="text-9xl font-black text-white animate-pulse"
            style={{ textShadow: '0 8px 32px rgba(0,0,0,0.9), 0 0 80px rgba(255,255,255,0.5)' }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Recording Timer Overlay */}
      {isRecording && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
          <div className="flex items-center gap-3 bg-red-500/90 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl">
            <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
            <span className="text-white text-2xl font-bold tracking-wider">
              00:{recordingTime.toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {/* Text Input Overlay */}
      <TextInputOverlay isOpen={showTextInput} onClose={() => setShowTextInput(false)} />

      {/* Text-to-AR Modal */}
      {showTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create Text Sticker</h2>
              <button
                onClick={() => setShowTextModal(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-all text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Text Input */}
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerateText()}
              placeholder="Enter your text..."
              className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white text-xl font-bold placeholder-white/40 focus:outline-none focus:border-white/40 transition-all mb-6"
              autoFocus
            />

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowTextModal(false)}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateText}
                disabled={!textInput.trim()}
                className="flex-1 px-6 py-3 bg-white hover:bg-white/90 rounded-lg text-black font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Review Modal - Photo & Video */}
      {(capturedPhoto || recordedVideo) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            {/* Display Captured Media */}
            <div className="relative max-w-4xl max-h-[80vh] mb-8">
              {capturedPhoto ? (
                <img 
                  src={capturedPhoto} 
                  alt="Captured photo" 
                  className="max-w-full max-h-[80vh] rounded-lg bg-white shadow-2xl"
                />
              ) : recordedVideo ? (
                <video 
                  src={recordedVideo} 
                  controls 
                  autoPlay 
                  loop
                  className="max-w-full max-h-[80vh] rounded-lg bg-white shadow-2xl"
                />
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-white/90 rounded-full text-black font-bold transition-all active:scale-95"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
              <button
                onClick={handleCloseReview}
                className="flex items-center gap-2 px-8 py-4 bg-red-500 hover:bg-red-600 rounded-full text-white font-bold transition-all active:scale-95"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
