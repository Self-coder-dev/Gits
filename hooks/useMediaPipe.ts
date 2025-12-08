"use client"

import { useEffect, useRef, useState } from "react"
import { HolisticLandmarker, FilesetResolver, HolisticLandmarkerResult } from "@mediapipe/tasks-vision"

// --- CONSTANTS ---
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const UPPER_BODY_CONNECTIONS = [[11,12], [11,13], [13,15], [12,14], [14,16]];

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  activeSticker: string | null,
  isSnapEnabled: boolean,
  manualScale: number = 1,
  manualRotation: number = 0
) {
  const [isReady, setIsReady] = useState(false)
  const holisticLandmarkerRef = useRef<HolisticLandmarker | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isInitializingRef = useRef(false)
  
  // State for dragging and anchoring
  const anchorTarget = useRef<'chest' | 'face' | 'manual'>('manual') // Default to manual for safety
  const isPinching = useRef(false)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  
  // State for manual positioning (Floating Mode)
  // We sync this constantly so transitions are smooth
  const stickerPos = useRef({ x: 0.5, y: 0.5, scale: 1, rotation: 0 })
  const stickerImageRef = useRef<HTMLImageElement | null>(null)
  const loadedStickerUrlRef = useRef<string | null>(null)

  // 1. Initialize MediaPipe
  useEffect(() => {
    if (isInitializingRef.current) return
    let isMounted = true

    async function initializeHolistic() {
      try {
        isInitializingRef.current = true
        console.log("Loading MediaPipe...")
        
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        )

        const holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minFaceDetectionConfidence: 0.5,
          minPoseDetectionConfidence: 0.5,
          minHandLandmarksConfidence: 0.5,
        })

        if (isMounted) {
            holisticLandmarkerRef.current = holisticLandmarker
            setIsReady(true)
            console.log("✅ MediaPipe Ready")
        }
      } catch (error) {
        console.error("MediaPipe Init Error:", error)
      } finally {
        isInitializingRef.current = false
      }
    }

    if (typeof window !== "undefined") initializeHolistic()
    
    return () => {
      isMounted = false
      if (holisticLandmarkerRef.current) holisticLandmarkerRef.current.close()
    }
  }, [])

  // 2. Handle Sticker Loading
  useEffect(() => {
    if (!activeSticker) {
        stickerImageRef.current = null
        return
    }
    if (activeSticker === loadedStickerUrlRef.current) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = activeSticker
    img.onload = () => {
        stickerImageRef.current = img
        loadedStickerUrlRef.current = activeSticker
        // When new sticker loads, reset to center manual
        stickerPos.current = { x: 0.5, y: 0.5, scale: 1, rotation: 0 }
        anchorTarget.current = 'manual'
    }
    img.onerror = (e) => console.error("Sticker Load Failed", e)
  }, [activeSticker])

  // 3. Render Loop
  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function processFrame() {
      if (!video || !canvas || !ctx || !holisticLandmarkerRef.current) return

      if (video.readyState >= 2) {
        // Setup Canvas
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const width = canvas.width
        const height = canvas.height
        
        // A. Draw Video Background
        ctx.save()
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        // B. Detect Landmarks
        let results: HolisticLandmarkerResult | null = null
        try {
             results = holisticLandmarkerRef.current.detectForVideo(video, performance.now())
        } catch(e) { /* ignore frame errors */ }

        // --- C. CALCULATE STICKER POSITION (Physics) ---
        // We do this BEFORE drawing so we have the latest numbers.
        
        let drawX = stickerPos.current.x * width
        let drawY = stickerPos.current.y * height
        let drawScale = stickerPos.current.scale * manualScale
        let drawRotation = stickerPos.current.rotation + (manualRotation * Math.PI / 180)

        // Force Manual if Snap is Disabled
        if (!isSnapEnabled) {
            anchorTarget.current = 'manual'
        }

        if (results && results.poseLandmarks && results.poseLandmarks.length > 0) {
            const pose = results.poseLandmarks[0]
            
            // Chest Logic
            if (isSnapEnabled && anchorTarget.current === 'chest') {
                const left = pose[11]; const right = pose[12]
                drawX = ((1 - left.x) + (1 - right.x)) / 2 * width
                drawY = (left.y + right.y) / 2 * height
                
                const angle = Math.atan2(right.y - left.y, (1-right.x) - (1-left.x))
                drawRotation = angle + (manualRotation * Math.PI / 180)
                
                const shoulderDist = Math.hypot((1-right.x) - (1-left.x), right.y - left.y)
                // Use a relative scale based on sticker size, not just raw pixels
                drawScale = (shoulderDist * 3.0) * manualScale 

                // SYNC STATE: Save these calculated values back to stickerPos
                // This prevents the "Huge/Frozen" bug when you switch back to Manual
                stickerPos.current = { 
                    x: drawX/width, 
                    y: drawY/height, 
                    scale: drawScale, // Bake the dynamic scale
                    rotation: drawRotation 
                }
            } 
            // Face Logic
            else if (isSnapEnabled && anchorTarget.current === 'face' && results.faceLandmarks) {
                const face = results.faceLandmarks[0]
                if (face) {
                    const noseBridge = face[168]
                    drawX = (1 - noseBridge.x) * width
                    drawY = noseBridge.y * height
                    
                    const leftEye = face[33]; const rightEye = face[263]
                    const angle = Math.atan2(rightEye.y - leftEye.y, (1-rightEye.x) - (1-leftEye.x))
                    drawRotation = angle + Math.PI + (manualRotation * Math.PI / 180)
                    
                    const leftEar = face[234]; const rightEar = face[454]
                    const earDist = Math.hypot((1-rightEar.x) - (1-leftEar.x), rightEar.y - leftEar.y)
                    drawScale = (earDist * 3.0) * manualScale
                    
                    // SYNC STATE
                    stickerPos.current = { x: drawX/width, y: drawY/height, scale: drawScale, rotation: drawRotation }
                }
            }
        }
        
        // --- D. DRAW STICKER (Layer 2 - Middle) ---
        // Drawn BEFORE wireframe so hand lines appear ON TOP (X-Ray effect)
        if (stickerImageRef.current) {
            ctx.save()
            ctx.translate(drawX, drawY)
            ctx.rotate(drawRotation)
            
            const sWidth = stickerImageRef.current.width
            const sHeight = stickerImageRef.current.height
            // Use a consistent base size reference
            const baseSize = width * 0.2 
            const finalW = baseSize * drawScale
            const finalH = (finalW / sWidth) * sHeight
            
            ctx.drawImage(stickerImageRef.current, -finalW/2, -finalH/2, finalW, finalH)
            ctx.restore()
        }

        // --- E. DRAW WIREFRAME (Layer 3 - Top / X-Ray) ---
        if (results) {
            ctx.save()
            ctx.translate(width, 0)
            ctx.scale(-1, 1) 
            
            // Green Hands
            ctx.strokeStyle = 'white'
            ctx.fillStyle = 'red'
            ctx.lineWidth = 2
            
            const drawConnection = (landmarks: any[], pairs: number[][]) => {
                if(!landmarks) return
                for(const hand of landmarks) {
                    for(const [start, end] of pairs) {
                        const p1 = hand[start]; const p2 = hand[end]
                        ctx.beginPath(); ctx.moveTo(p1.x * width, p1.y * height); ctx.lineTo(p2.x * width, p2.y * height); ctx.stroke()
                    }
                    for(const p of hand) {
                        ctx.beginPath(); ctx.arc(p.x * width, p.y * height, 2, 0, 2 * Math.PI); ctx.fill()
                    }
                }
            }
            drawConnection(results.leftHandLandmarks, HAND_CONNECTIONS)
            drawConnection(results.rightHandLandmarks, HAND_CONNECTIONS)

            // Cyan Chest
            if (results.poseLandmarks && results.poseLandmarks.length > 0) {
                const pose = results.poseLandmarks[0]
                ctx.strokeStyle = 'white'
                ctx.lineWidth = 2
                for (const [start, end] of UPPER_BODY_CONNECTIONS) {
                    const p1 = pose[start]; const p2 = pose[end]
                    ctx.beginPath(); ctx.moveTo(p1.x * width, p1.y * height); ctx.lineTo(p2.x * width, p2.y * height); ctx.stroke()
                }
            }
            ctx.restore()

            // --- F. GESTURE LOGIC (Pinch) ---
            let cursor = { x: 0, y: 0, active: false }
            const checkPinch = (landmarks: any[]) => {
                if (!landmarks || landmarks.length === 0) return null
                const hand = landmarks[0]
                const thumb = hand[4]; const index = hand[8]
                const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y)
                if (dist < 0.08) return { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 }
                return null
            }
            const activePinch = checkPinch(results.leftHandLandmarks) || checkPinch(results.rightHandLandmarks)

            if (activePinch) {
                cursor = { x: (1 - activePinch.x) * width, y: activePinch.y * height, active: true }
                
                // Draw Pinch Cursor (Topmost)
                ctx.beginPath(); ctx.arc(cursor.x, cursor.y, 8, 0, Math.PI * 2); ctx.fillStyle = 'cyan'; ctx.fill()

                if (!isPinching.current) {
                    isPinching.current = true
                    // Check Hitbox
                    const dx = cursor.x - drawX
                    const dy = cursor.y - drawY
                    if (Math.hypot(dx, dy) < 100) { 
                        isDragging.current = true
                        dragOffset.current = { x: dx, y: dy }
                        anchorTarget.current = 'manual' // Detach on Grab
                    }
                }
                if (isDragging.current) {
                    // Update sticker position immediately while dragging
                    stickerPos.current.x = (cursor.x - dragOffset.current.x) / width
                    stickerPos.current.y = (cursor.y - dragOffset.current.y) / height
                    // We don't reset scale here, we keep the last known scale
                }
            } else {
                if (isPinching.current) {
                    isPinching.current = false
                    isDragging.current = false
                    
                    // SNAP LOGIC (Only on Release)
                    if (isSnapEnabled && results.poseLandmarks && results.poseLandmarks.length > 0) {
                        const pose = results.poseLandmarks[0]
                        const nose = pose[1]
                        const chest = { x: (pose[11].x + pose[12].x) / 2, y: (pose[11].y + pose[12].y) / 2 }
                        
                        const distToNose = Math.hypot(stickerPos.current.x - (1-nose.x), stickerPos.current.y - nose.y)
                        const distToChest = Math.hypot(stickerPos.current.x - (1-chest.x), stickerPos.current.y - chest.y)
                        
                        if (distToNose < distToChest && distToNose < 0.2) anchorTarget.current = 'face'
                        else if (distToChest < 0.3) anchorTarget.current = 'chest'
                    }
                }
            }
        }
      }
      animationFrameRef.current = requestAnimationFrame(processFrame)
    }

    processFrame()
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) }
  }, [isReady, isSnapEnabled, manualScale, manualRotation])

  return { isReady }
}