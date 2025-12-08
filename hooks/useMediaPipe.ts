"use client"

import { useEffect, useRef, useState } from "react"
import { HolisticLandmarker, FilesetResolver, HolisticLandmarkerResult } from "@mediapipe/tasks-vision"

// --- CONSTANTS ---
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const UPPER_BODY_CONNECTIONS = [[11,12], [11,13], [13,15], [12,14], [14,16]];
const FACE_ANCHORS = [1, 33, 133, 263, 362]; // Nose tip + Eye corners for HUD

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
  const anchorTarget = useRef<'chest' | 'face' | 'manual'>('chest')
  const isPinching = useRef(false)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  
  // State for manual positioning (Floating Mode)
  const stickerPos = useRef({ x: 0.5, y: 0.5, scale: 1, rotation: 0 })
  const stickerImageRef = useRef<HTMLImageElement | null>(null)
  const loadedStickerUrlRef = useRef<string | null>(null)

  // 1. Initialize MediaPipe (The AI Brain)
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
        // Reset position to center if manual
        if (!isSnapEnabled) {
             stickerPos.current = { x: 0.5, y: 0.5, scale: 1, rotation: 0 }
             anchorTarget.current = 'manual'
        }
    }
    img.onerror = (e) => console.error("Sticker Load Failed", e)
  }, [activeSticker, isSnapEnabled])

  // 3. Snap Safety Watchdog
  useEffect(() => {
      // If user turns Snap ON, force it to snap to chest immediately if it was floating
      if (isSnapEnabled && anchorTarget.current === 'manual') {
          anchorTarget.current = 'chest'
      }
  }, [isSnapEnabled])

  // 4. The Render Loop (60 FPS)
  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function processFrame() {
      if (!video || !canvas || !ctx || !holisticLandmarkerRef.current) return

      if (video.readyState >= 2) {
        // A. Setup Canvas
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        // B. Draw Video Background
        ctx.save()
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1) // Mirror video
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        // C. Detect Landmarks
        let results: HolisticLandmarkerResult | null = null
        try {
             results = holisticLandmarkerRef.current.detectForVideo(video, performance.now())
        } catch(e) { /* ignore frame errors */ }

        if (results) {
            const width = canvas.width
            const height = canvas.height

            // D. Hand Gesture Logic (The Pinch)
            let cursor = { x: 0, y: 0, active: false }
            
            // Check pinch (Left or Right hand)
            const checkPinch = (landmarks: any[]) => {
                if (!landmarks || landmarks.length === 0) return null
                const hand = landmarks[0]
                const thumb = hand[4]
                const index = hand[8]
                const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y)
                if (dist < 0.08) {
                    return { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 }
                }
                return null
            }

            const leftPinch = checkPinch(results.leftHandLandmarks)
            const rightPinch = checkPinch(results.rightHandLandmarks)
            const activePinch = leftPinch || rightPinch

            if (activePinch) {
                cursor = { x: (1 - activePinch.x) * width, y: activePinch.y * height, active: true } // Mirror X
                
                // Draw Cursor
                ctx.beginPath()
                ctx.arc(cursor.x, cursor.y, 8, 0, Math.PI * 2)
                ctx.fillStyle = 'cyan'
                ctx.fill()

                // Drag Logic
                if (!isPinching.current) {
                    // Just started pinching
                    isPinching.current = true
                    // Check if near sticker
                    const dx = cursor.x - (stickerPos.current.x * width)
                    const dy = cursor.y - (stickerPos.current.y * height)
                    if (Math.hypot(dx, dy) < 100) { // Hitbox
                        isDragging.current = true
                        dragOffset.current = { x: dx, y: dy }
                        anchorTarget.current = 'manual' // Detach when grabbing
                    }
                }

                if (isDragging.current) {
                    stickerPos.current.x = (cursor.x - dragOffset.current.x) / width
                    stickerPos.current.y = (cursor.y - dragOffset.current.y) / height
                }
            } else {
                // Released Pinch
                if (isPinching.current) {
                    isPinching.current = false
                    isDragging.current = false
                    
                    // Snap Logic (Only if Enabled)
                    if (isSnapEnabled && results.poseLandmarks && results.poseLandmarks.length > 0) {
                        const pose = results.poseLandmarks[0]
                        const nose = pose[1] // Nose tip
                        const chest = { 
                            x: (pose[11].x + pose[12].x) / 2,
                            y: (pose[11].y + pose[12].y) / 2
                        }
                        
                        // Distance check (normalized coords)
                        const distToNose = Math.hypot(stickerPos.current.x - (1-nose.x), stickerPos.current.y - nose.y)
                        const distToChest = Math.hypot(stickerPos.current.x - (1-chest.x), stickerPos.current.y - chest.y)
                        
                        if (distToNose < distToChest && distToNose < 0.2) {
                            anchorTarget.current = 'face'
                        } else if (distToChest < 0.3) {
                            anchorTarget.current = 'chest'
                        }
                    }
                }
            }

            // F. Calculate Sticker Position (The Physics Engine)
            let drawX = stickerPos.current.x * width
            let drawY = stickerPos.current.y * height
            let drawScale = stickerPos.current.scale * manualScale
            let drawRotation = stickerPos.current.rotation + (manualRotation * Math.PI / 180)

            if (results.poseLandmarks && results.poseLandmarks.length > 0) {
                const pose = results.poseLandmarks[0]
                
                if (anchorTarget.current === 'chest') {
                    const left = pose[11]; const right = pose[12]
                    drawX = ((1 - left.x) + (1 - right.x)) / 2 * width
                    drawY = (left.y + right.y) / 2 * height
                    
                    // Auto Rotation (Tilt)
                    const angle = Math.atan2(right.y - left.y, (1-right.x) - (1-left.x))
                    drawRotation = angle + (manualRotation * Math.PI / 180)
                    
                    // Auto Scale (Shoulder width)
                    const shoulderDist = Math.hypot((1-right.x) - (1-left.x), right.y - left.y)
                    drawScale = (shoulderDist * 2.5) * manualScale
                    
                    // Update ref for smooth transitions
                    stickerPos.current = { x: drawX/width, y: drawY/height, scale: drawScale, rotation: drawRotation }
                } 
                else if (anchorTarget.current === 'face' && results.faceLandmarks) {
                    // Face Anchor (Nose Bridge 168)
                    const face = results.faceLandmarks[0]
                    if (face) {
                        const noseBridge = face[168]
                        drawX = (1 - noseBridge.x) * width
                        drawY = noseBridge.y * height
                        
                        // Eye rotation
                        const leftEye = face[33]; const rightEye = face[263]
                        const angle = Math.atan2(rightEye.y - leftEye.y, (1-rightEye.x) - (1-leftEye.x))
                        drawRotation = angle + Math.PI + (manualRotation * Math.PI / 180) // + PI to fix upside down
                        
                        // Ear scale
                        const leftEar = face[234]; const rightEar = face[454]
                        const earDist = Math.hypot((1-rightEar.x) - (1-leftEar.x), rightEar.y - leftEar.y)
                        drawScale = (earDist * 3.0) * manualScale
                        
                         stickerPos.current = { x: drawX/width, y: drawY/height, scale: drawScale, rotation: drawRotation }
                    }
                }
            }

            // G. Draw Sticker (BEFORE Wireframe)
            if (stickerImageRef.current) {
                // If snap disabled and still manual, use center if no pos set?
                // Already handled by init load
                
                ctx.save()
                ctx.translate(drawX, drawY)
                ctx.rotate(drawRotation)
                
                // Draw image centered
                const sWidth = stickerImageRef.current.width
                const sHeight = stickerImageRef.current.height
                // Normalize size base
                const baseSize = width * 0.2 // Base size factor
                const finalW = baseSize * drawScale
                const finalH = (finalW / sWidth) * sHeight
                
                ctx.drawImage(stickerImageRef.current, -finalW/2, -finalH/2, finalW, finalH)
                ctx.restore()
            }

            // H. Draw HUD Wireframe (ON TOP of Sticker)
            ctx.save()
            ctx.translate(width, 0)
            ctx.scale(-1, 1) // Mirror HUD
            
            // Draw Hands (White Lines / Red Dots)
            ctx.strokeStyle = 'white'
            ctx.fillStyle = 'red'
            ctx.lineWidth = 2
            
            const drawConnection = (landmarks: any[], pairs: number[][]) => {
                if(!landmarks) return
                for(const hand of landmarks) {
                    for(const [start, end] of pairs) {
                        const p1 = hand[start]; const p2 = hand[end]
                        ctx.beginPath()
                        ctx.moveTo(p1.x * width, p1.y * height)
                        ctx.lineTo(p2.x * width, p2.y * height)
                        ctx.stroke()
                    }
                    for(const p of hand) {
                        ctx.beginPath(); ctx.arc(p.x * width, p.y * height, 2, 0, 2 * Math.PI); ctx.fill()
                    }
                }
            }
            drawConnection(results.leftHandLandmarks, HAND_CONNECTIONS)
            drawConnection(results.rightHandLandmarks, HAND_CONNECTIONS)

            // Draw Upper Body (White Lines / Red Dots)
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
        } // End results check
      }

      animationFrameRef.current = requestAnimationFrame(processFrame)
    }

    processFrame()

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isReady, isSnapEnabled, manualScale, manualRotation])

  return { isReady }
}