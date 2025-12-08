"use client"

import { useEffect, useRef, useState } from "react"
import { 
  HolisticLandmarker, 
  FilesetResolver, 
  HolisticLandmarkerResult
} from "@mediapipe/tasks-vision"

// Custom indices for selective wireframe visualization
const FACE_ANCHORS = [1, 33, 133, 263, 362] // 1=Nose Tip, 33/263=Eye corners, 133/362=Eye corners
const UPPER_BODY_INDICES = [11, 12, 13, 14, 15, 16] // Shoulders(11,12), Elbows(13,14), Wrists(15,16)
const UPPER_BODY_CONNECTIONS = [
  [11, 12],  // Chest line (left shoulder to right shoulder)
  [11, 13],  // Left shoulder to left elbow
  [13, 15],  // Left elbow to left wrist
  [12, 14],  // Right shoulder to right elbow
  [14, 16]   // Right elbow to right wrist
]

// Hand connections (21 landmarks per hand)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],      // Thumb
  [0,5],[5,6],[6,7],[7,8],      // Index finger
  [5,9],[9,10],[10,11],[11,12], // Middle finger
  [9,13],[13,14],[14,15],[15,16], // Ring finger
  [13,17],[17,18],[18,19],[19,20], // Pinky
  [0,17]                         // Palm base
]

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  activeSticker: string | null = null,
  isSnapEnabled: boolean = true,
  manualScale: number = 1,
  manualRotation: number = 0
) {
  const [isReady, setIsReady] = useState(false)
  const holisticLandmarkerRef = useRef<HolisticLandmarker | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isInitializingRef = useRef(false)
  const stickerImageRef = useRef<HTMLImageElement | null>(null)
  const loadedStickerUrlRef = useRef<string | null>(null)
  
  // Gesture control state
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const stickerPositionRef = useRef<{ x: number; y: number; anchor: 'shoulders' | 'manual' } | null>(null)
  const lastPinchStateRef = useRef(false)
  const anchorTargetRef = useRef<'chest' | 'face'>('chest')
  
  // Store last known scale and rotation for manual mode
  const lastScaleRef = useRef<number>(0)
  const lastRotationRef = useRef<number>(0)

  // Initialize MediaPipe Holistic Landmarker
  useEffect(() => {
    // Guard: prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      console.log("⚠️ Already initializing, skipping...")
      return
    }

    let isMounted = true

    async function initializeHolistic() {
      try {
        // Set initialization guard
        isInitializingRef.current = true
        console.log("Step 1: Starting MediaPipe Holistic Landmarker initialization...")

        // Step 1: Load MediaPipe FilesetResolver FIRST
        console.log("Step 2: Loading FilesetResolver from CDN...")
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        )
        console.log("Step 3: FilesetResolver loaded successfully!")

        // Step 2: ONLY THEN create HolisticLandmarker with the vision object
        console.log("Step 4: Creating HolisticLandmarker with model...")
        
        let holisticLandmarker: HolisticLandmarker | null = null
        
        // Try GPU first
        try {
          console.log("Step 4a: Attempting GPU acceleration...")
          holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minHandLandmarksConfidence: 0.5,
            outputFaceBlendshapes: false,
            outputPoseSegmentationMasks: false,
          })
          console.log("Step 4b: ✅ GPU acceleration enabled!")
        } catch (gpuError) {
          console.warn("⚠️ GPU acceleration failed, falling back to CPU...")
          console.warn("GPU error:", gpuError)
          
          // Fallback to CPU
          holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minHandLandmarksConfidence: 0.5,
            outputFaceBlendshapes: false,
            outputPoseSegmentationMasks: false,
          })
          console.log("Step 4c: ✅ CPU mode enabled!")
        }
        
        console.log("Step 5: HolisticLandmarker created successfully!")

        if (isMounted && holisticLandmarker) {
          holisticLandmarkerRef.current = holisticLandmarker
          setIsReady(true)
          console.log("✅ MediaPipe Holistic Landmarker is ready!")
        }
      } catch (error) {
        console.error("❌ ERROR initializing MediaPipe Holistic Landmarker:")
        console.error("Error type:", error instanceof Error ? error.name : typeof error)
        console.error("Error message:", error instanceof Error ? error.message : error)
        console.error("Full error:", error)
      } finally {
        // Reset initialization guard after completion (success or error)
        if (isMounted) {
          isInitializingRef.current = false
        }
      }
    }

    // Only initialize in browser environment
    if (typeof window !== "undefined") {
      initializeHolistic()
    } else {
      console.log("Skipping MediaPipe initialization (SSR environment)")
      isInitializingRef.current = false
    }

    return () => {
      isMounted = false
      isInitializingRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (holisticLandmarkerRef.current) {
        holisticLandmarkerRef.current.close()
      }
    }
  }, [])

  // Load sticker image when activeSticker changes
  useEffect(() => {
    if (activeSticker && activeSticker !== loadedStickerUrlRef.current) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        stickerImageRef.current = img
        loadedStickerUrlRef.current = activeSticker
        console.log("✅ Sticker loaded:", activeSticker)
        
        // INITIALIZATION FIX: If snapping is OFF, center the sticker on screen
        if (!isSnapEnabled && canvasRef.current) {
          const canvas = canvasRef.current
          stickerPositionRef.current = { 
            x: canvas.width / 2, 
            y: canvas.height / 2, 
            anchor: 'manual' 
          }
          console.log("🎯 Sticker initialized at center (Floating Mode)")
        }
      }
      img.onerror = (error) => {
        console.error("❌ Failed to load sticker:", error)
        stickerImageRef.current = null
        loadedStickerUrlRef.current = null
      }
      img.src = activeSticker
    } else if (!activeSticker) {
      stickerImageRef.current = null
      loadedStickerUrlRef.current = null
    }
  }, [activeSticker, isSnapEnabled])

  // FIX 1: Snap Re-Enable Logic - Force snap back to body when re-enabled
  useEffect(() => {
    if (isSnapEnabled && stickerPositionRef.current?.anchor === 'manual') {
      // Reset to chest anchor when snap is re-enabled
      anchorTargetRef.current = 'chest'
      stickerPositionRef.current.anchor = 'shoulders'
      console.log("🔄 Snap re-enabled - sticker will now track body")
    }
  }, [isSnapEnabled])

  // Process video frames and draw landmarks/stickers
  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let lastVideoTime = -1

    function processFrame() {
      if (!video || !canvas || !ctx || !holisticLandmarkerRef.current) return

      const currentTime = video.currentTime

      // Only process if we have a new frame
      if (currentTime !== lastVideoTime && video.readyState >= 2) {
        lastVideoTime = currentTime

        try {
          // Fix Resolution: Set canvas size to match video exactly
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          // Detect landmarks
          const results = holisticLandmarkerRef.current.detectForVideo(
            video,
            performance.now()
          )

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          // CRITICAL: Draw video frame FIRST (as background layer)
          ctx.save()
          ctx.scale(-1, 1)  // Mirror to match video display
          ctx.translate(-canvas.width, 0)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          ctx.restore()

          // Draw wireframe (skeleton) OVER video
          drawWireframe(ctx, results, canvas.width, canvas.height)

          // Draw AR sticker or debug landmarks
          if (activeSticker && stickerImageRef.current) {
            try {
              drawARSticker(
                ctx, 
                results, 
                canvas.width, 
                canvas.height, 
                stickerImageRef.current,
                isDraggingRef,
                dragOffsetRef,
                stickerPositionRef,
                lastPinchStateRef,
                anchorTargetRef,
                isSnapEnabled,
                lastScaleRef,
                lastRotationRef,
                manualScale,
                manualRotation
              )
            } catch (drawError) {
              console.error("Error drawing sticker:", drawError)
              // Fallback to debug dots if sticker fails
              drawDebugLandmarks(ctx, results, canvas.width, canvas.height)
            }
          } else {
            // Fallback to debug dots
            drawDebugLandmarks(ctx, results, canvas.width, canvas.height)
          }
          
          // Draw gesture cursor for hand control
          drawGestureCursor(ctx, results, canvas.width, canvas.height)
        } catch (error) {
          console.error("Error processing frame:", error)
        }
      }

      animationFrameRef.current = requestAnimationFrame(processFrame)
    }

    // Start processing
    processFrame()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isReady, videoRef, canvasRef, activeSticker, isSnapEnabled, manualScale, manualRotation])

  return { isReady }
}

// Helper: Calculate Euclidean distance
function getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y)
}

// Draw wireframe (selective skeleton visualization)
function drawWireframe(
  ctx: CanvasRenderingContext2D,
  results: HolisticLandmarkerResult,
  width: number,
  height: number
) {
  // Helper: Draw specific connections
  function drawConnections(
    landmarks: any[],
    connections: number[][],
    color: string,
    lineWidth: number
  ) {
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.beginPath()

    for (const [startIdx, endIdx] of connections) {
      const start = landmarks[startIdx]
      const end = landmarks[endIdx]

      if (start && end) {
        const startX = (1 - start.x) * width
        const startY = start.y * height
        const endX = (1 - end.x) * width
        const endY = end.y * height

        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
      }
    }

    ctx.stroke()
  }

  // Helper: Draw specific landmarks by indices
  function drawSpecificLandmarks(
    landmarks: any[],
    indices: number[],
    color: string,
    radius: number
  ) {
    ctx.fillStyle = color

    for (const idx of indices) {
      const landmark = landmarks[idx]
      if (landmark) {
        const x = (1 - landmark.x) * width
        const y = landmark.y * height

        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
  }

  // Helper: Draw all landmarks
  function drawAllLandmarks(
    landmarks: any[],
    color: string,
    radius: number
  ) {
    ctx.fillStyle = color

    for (const landmark of landmarks) {
      if (landmark) {
        const x = (1 - landmark.x) * width
        const y = landmark.y * height

        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
  }

  // Helper: Draw hand connections using local HAND_CONNECTIONS array
  function drawHandConnectors(
    landmarks: any[],
    lineWidth: number
  ) {
    ctx.strokeStyle = "white"
    ctx.lineWidth = lineWidth
    ctx.beginPath()

    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
      const start = landmarks[startIdx]
      const end = landmarks[endIdx]

      if (start && end) {
        const startX = (1 - start.x) * width
        const startY = start.y * height
        const endX = (1 - end.x) * width
        const endY = end.y * height

        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
      }
    }

    ctx.stroke()
  }

  // NOTE: Face wireframe removed - clean face visualization

  // 1. Upper Body Only (White Lines + Red Dots)
  if (results.poseLandmarks && results.poseLandmarks.length > 0) {
    const pose = results.poseLandmarks[0]
    // Draw white lines
    drawConnections(pose, UPPER_BODY_CONNECTIONS, "white", 2)
    // Draw red dots at specific indices
    drawSpecificLandmarks(pose, UPPER_BODY_INDICES, "red", 3)
  }

  // 2. Full Left Hand (White Lines + Red Dots)
  if (results.leftHandLandmarks && results.leftHandLandmarks.length > 0) {
    const leftHand = results.leftHandLandmarks[0]
    drawHandConnectors(leftHand, 2)
    drawAllLandmarks(leftHand, "red", 3)
  }

  // 3. Full Right Hand (White Lines + Red Dots)
  if (results.rightHandLandmarks && results.rightHandLandmarks.length > 0) {
    const rightHand = results.rightHandLandmarks[0]
    drawHandConnectors(rightHand, 2)
    drawAllLandmarks(rightHand, "red", 3)
  }
}

// Draw gesture cursor (virtual hand pointer)
function drawGestureCursor(
  ctx: CanvasRenderingContext2D,
  results: HolisticLandmarkerResult,
  width: number,
  height: number
) {
  // Check for right hand (primary hand for control)
  if (!results.rightHandLandmarks || results.rightHandLandmarks.length === 0) return

  const hand = results.rightHandLandmarks[0]
  const indexTip = hand[8]  // Index finger tip
  const thumbTip = hand[4]   // Thumb tip

  if (!indexTip || !thumbTip) return

  // Calculate distance between index and thumb (pinch detection)
  const distance = getDistance(indexTip, thumbTip)
  const isPinching = distance < 0.08

  // Calculate cursor position (midpoint between index and thumb)
  const cursorX = (1 - (indexTip.x + thumbTip.x) / 2) * width
  const cursorY = ((indexTip.y + thumbTip.y) / 2) * height

  // Draw cursor
  ctx.save()
  ctx.beginPath()
  ctx.arc(cursorX, cursorY, isPinching ? 15 : 10, 0, 2 * Math.PI)
  
  if (isPinching) {
    // Cyan when pinching (grabbing)
    ctx.fillStyle = "rgba(0, 255, 255, 0.8)"
    ctx.strokeStyle = "rgba(0, 255, 255, 1)"
  } else {
    // White when hovering
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
  }
  
  ctx.lineWidth = 2
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

// Draw AR Sticker anchored to shoulders or face with gesture control
function drawARSticker(
  ctx: CanvasRenderingContext2D,
  results: HolisticLandmarkerResult,
  width: number,
  height: number,
  stickerImage: HTMLImageElement,
  isDraggingRef: React.MutableRefObject<boolean>,
  dragOffsetRef: React.MutableRefObject<{ x: number; y: number }>,
  stickerPositionRef: React.MutableRefObject<{ x: number; y: number; anchor: 'shoulders' | 'manual' } | null>,
  lastPinchStateRef: React.MutableRefObject<boolean>,
  anchorTargetRef: React.MutableRefObject<'chest' | 'face'>,
  isSnapEnabled: boolean,
  lastScaleRef: React.MutableRefObject<number>,
  lastRotationRef: React.MutableRefObject<number>,
  manualScale: number,
  manualRotation: number
) {
  // Check if we have pose landmarks
  if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
    // NO POSE DETECTED - But still render sticker in manual mode if snap is OFF
    if (!isSnapEnabled && stickerPositionRef.current) {
      // Use stored position and last known scale/rotation
      const finalX = stickerPositionRef.current.x
      const finalY = stickerPositionRef.current.y
      const finalWidth = (lastScaleRef.current || width * 0.3) * manualScale  // Apply manual scale
      const aspectRatio = stickerImage.height / stickerImage.width
      const finalHeight = finalWidth * aspectRatio
      const finalAngle = (lastRotationRef.current || 0) + (manualRotation * Math.PI / 180)  // Apply manual rotation

      ctx.save()
      ctx.translate(finalX, finalY)
      ctx.scale(-1, 1)
      ctx.rotate(finalAngle)
      ctx.drawImage(
        stickerImage,
        -finalWidth / 2,
        -finalHeight / 2,
        finalWidth,
        finalHeight
      )
      ctx.restore()
      
      console.log("🎨 Rendered sticker in manual mode (no pose detected)")
    }
    return
  }

  const landmarks = results.poseLandmarks[0]
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const nose = landmarks[0]

  if (!leftShoulder || !rightShoulder) return

  // Fix Mirroring: Flip X coordinates (1 - x) to match mirrored video
  const leftX = (1 - leftShoulder.x) * width
  const leftY = leftShoulder.y * height
  const rightX = (1 - rightShoulder.x) * width
  const rightY = rightShoulder.y * height

  // Calculate shoulder midpoint (chest center)
  const shoulderMidX = (leftX + rightX) / 2
  const shoulderMidY = (leftY + rightY) / 2

  // Calculate shoulder rotation angle
  const shoulderAngle = Math.atan2(rightY - leftY, rightX - leftX)

  // Calculate shoulder distance for sizing
  const shoulderDistance = Math.sqrt(
    Math.pow(rightX - leftX, 2) + Math.pow(rightY - leftY, 2)
  )

  // Get face landmarks for face anchoring
  let faceNoseX = shoulderMidX
  let faceNoseY = shoulderMidY - 100
  let faceAngle = shoulderAngle
  let faceWidth = shoulderDistance * 2.5

  if (results.faceLandmarks && results.faceLandmarks.length > 0) {
    const face = results.faceLandmarks[0]
    const noseBridge = face[168] // Nose Bridge (between eyes) - better for glasses
    const leftEye = face[33]
    const rightEye = face[263]
    const leftEar = face[234]  // Approximate ear position
    const rightEar = face[454] // Approximate ear position

    if (noseBridge) {
      faceNoseX = (1 - noseBridge.x) * width
      faceNoseY = noseBridge.y * height
    }

    // Calculate face rotation from eyes
    if (leftEye && rightEye) {
      const leftEyeX = (1 - leftEye.x) * width
      const leftEyeY = leftEye.y * height
      const rightEyeX = (1 - rightEye.x) * width
      const rightEyeY = rightEye.y * height
      // Add 180-degree flip (Math.PI) to fix upside-down rendering on face
      faceAngle = Math.atan2(rightEyeY - leftEyeY, rightEyeX - leftEyeX) + Math.PI
    }

    // Calculate face width from ears if available, otherwise use eyes
    if (leftEar && rightEar) {
      const leftEarX = (1 - leftEar.x) * width
      const rightEarX = (1 - rightEar.x) * width
      const earDistance = Math.abs(rightEarX - leftEarX)
      faceWidth = earDistance * 3.0
    } else if (leftEye && rightEye) {
      const leftEyeX = (1 - leftEye.x) * width
      const rightEyeX = (1 - rightEye.x) * width
      const eyeDistance = Math.abs(rightEyeX - leftEyeX)
      faceWidth = eyeDistance * 3.5
    }
  }

  // === GESTURE CONTROL LOGIC ===
  
  // Detect pinch gesture (right hand)
  let isPinching = false
  let cursorX = 0
  let cursorY = 0

  if (results.rightHandLandmarks && results.rightHandLandmarks.length > 0) {
    const hand = results.rightHandLandmarks[0]
    const indexTip = hand[8]
    const thumbTip = hand[4]

    if (indexTip && thumbTip) {
      const distance = getDistance(indexTip, thumbTip)
      isPinching = distance < 0.08

      // Calculate cursor position (mirrored)
      cursorX = (1 - (indexTip.x + thumbTip.x) / 2) * width
      cursorY = ((indexTip.y + thumbTip.y) / 2) * height
    }
  }

  // Determine anchor point based on target
  let anchorX: number
  let anchorY: number
  let anchorAngle: number
  let anchorWidth: number

  if (anchorTargetRef.current === 'face') {
    anchorX = faceNoseX
    anchorY = faceNoseY
    anchorAngle = faceAngle
    anchorWidth = faceWidth
  } else {
    // chest
    anchorX = shoulderMidX
    anchorY = shoulderMidY
    anchorAngle = shoulderAngle
    anchorWidth = shoulderDistance * 2.5
  }

  // Calculate height maintaining aspect ratio
  const aspectRatio = stickerImage.height / stickerImage.width
  const stickerHeight = anchorWidth * aspectRatio

  // Initialize position if first time
  if (!stickerPositionRef.current) {
    stickerPositionRef.current = { x: anchorX, y: anchorY, anchor: 'shoulders' }
  }

  // Detect pinch start (grab)
  if (isPinching && !lastPinchStateRef.current) {
    // Check if cursor is near sticker
    const distToSticker = Math.hypot(
      cursorX - stickerPositionRef.current.x,
      cursorY - stickerPositionRef.current.y
    )
    
    if (distToSticker < anchorWidth / 2) {
      // Start dragging
      isDraggingRef.current = true
      dragOffsetRef.current = {
        x: cursorX - stickerPositionRef.current.x,
        y: cursorY - stickerPositionRef.current.y
      }
      stickerPositionRef.current.anchor = 'manual'
    }
  }

  // Detect pinch end (release) - Snap Logic
  if (!isPinching && lastPinchStateRef.current && isDraggingRef.current) {
    // Stop dragging
    isDraggingRef.current = false

    // If snap is enabled, snap to closest anchor
    if (isSnapEnabled) {
      // Calculate distances to both anchor points
      const distToNose = Math.hypot(
        stickerPositionRef.current.x - faceNoseX,
        stickerPositionRef.current.y - faceNoseY
      )
      const distToChest = Math.hypot(
        stickerPositionRef.current.x - shoulderMidX,
        stickerPositionRef.current.y - shoulderMidY
      )

      // Snap to closest anchor
      if (distToNose < distToChest) {
        // Snap to face
        anchorTargetRef.current = 'face'
        stickerPositionRef.current = { x: faceNoseX, y: faceNoseY, anchor: 'shoulders' }
      } else {
        // Snap to chest
        anchorTargetRef.current = 'chest'
        stickerPositionRef.current = { x: shoulderMidX, y: shoulderMidY, anchor: 'shoulders' }
      }
    } else {
      // Snap disabled - keep sticker exactly where dropped (manual mode)
      stickerPositionRef.current.anchor = 'manual'
      // Position already set during drag, don't change it
    }
  }

  // Update last pinch state
  lastPinchStateRef.current = isPinching

  // Determine final position and size
  let finalX: number
  let finalY: number
  let finalAngle: number
  let finalWidth: number

  if (isDraggingRef.current) {
    // Manual drag mode
    stickerPositionRef.current.x = cursorX - dragOffsetRef.current.x
    stickerPositionRef.current.y = cursorY - dragOffsetRef.current.y
    finalX = stickerPositionRef.current.x
    finalY = stickerPositionRef.current.y
    finalAngle = anchorAngle + (manualRotation * Math.PI / 180)  // Apply manual rotation
    finalWidth = anchorWidth * manualScale  // Apply manual scale
  } else if (stickerPositionRef.current.anchor === 'shoulders') {
    // Auto-track anchor point
    stickerPositionRef.current.x = anchorX
    stickerPositionRef.current.y = anchorY
    finalX = anchorX
    finalY = anchorY
    finalAngle = anchorAngle + (manualRotation * Math.PI / 180)  // Apply manual rotation
    finalWidth = anchorWidth * manualScale  // Apply manual scale
  } else {
    // Manual position (frozen) - MANUAL FALLBACK for floating mode
    finalX = stickerPositionRef.current.x
    finalY = stickerPositionRef.current.y
    // Use last known scale and rotation instead of anchor values, plus manual adjustments
    finalAngle = (lastRotationRef.current || anchorAngle) + (manualRotation * Math.PI / 180)
    finalWidth = (lastScaleRef.current || anchorWidth) * manualScale
  }

  // Store current scale and rotation for next frame
  lastScaleRef.current = finalWidth / manualScale  // Store base scale without manual multiplier
  lastRotationRef.current = finalAngle - (manualRotation * Math.PI / 180)  // Store base rotation without manual addition

  const finalHeight = finalWidth * aspectRatio

  // Save canvas state
  ctx.save()

  // Move to final position
  ctx.translate(finalX, finalY)

  // Flip the image so it matches the body
  ctx.scale(-1, 1)

  // Apply rotation
  ctx.rotate(finalAngle)

  // Draw sticker centered at origin
  ctx.drawImage(
    stickerImage,
    -finalWidth / 2,
    -finalHeight / 2,
    finalWidth,
    finalHeight
  )

  // Restore canvas state
  ctx.restore()
}

// Draw debug landmarks (nose, shoulders, index fingers)
function drawDebugLandmarks(
  ctx: CanvasRenderingContext2D,
  results: HolisticLandmarkerResult,
  width: number,
  height: number
) {
  // Draw pose landmarks (nose and shoulders)
  if (results.poseLandmarks && results.poseLandmarks.length > 0) {
    const landmarks = results.poseLandmarks[0]

    // Nose (landmark 0) - Fix Mirroring: flip X coordinate
    if (landmarks[0]) {
      const x = (1 - landmarks[0].x) * width
      const y = landmarks[0].y * height
      drawLandmark(ctx, x, y, "red", 8)
    }

    // Left shoulder (landmark 11) - Fix Mirroring: flip X coordinate
    if (landmarks[11]) {
      const x = (1 - landmarks[11].x) * width
      const y = landmarks[11].y * height
      drawLandmark(ctx, x, y, "red", 8)
    }

    // Right shoulder (landmark 12) - Fix Mirroring: flip X coordinate
    if (landmarks[12]) {
      const x = (1 - landmarks[12].x) * width
      const y = landmarks[12].y * height
      drawLandmark(ctx, x, y, "red", 8)
    }
  }

  // Draw left hand index finger (landmark 8) - Fix Mirroring: flip X coordinate
  if (results.leftHandLandmarks && results.leftHandLandmarks.length > 0) {
    const leftHand = results.leftHandLandmarks[0]
    if (leftHand[8]) {
      const x = (1 - leftHand[8].x) * width
      const y = leftHand[8].y * height
      drawLandmark(ctx, x, y, "red", 8)
    }
  }

  // Draw right hand index finger (landmark 8) - Fix Mirroring: flip X coordinate
  if (results.rightHandLandmarks && results.rightHandLandmarks.length > 0) {
    const rightHand = results.rightHandLandmarks[0]
    if (rightHand[8]) {
      const x = (1 - rightHand[8].x) * width
      const y = rightHand[8].y * height
      drawLandmark(ctx, x, y, "red", 8)
    }
  }
}

// Helper function to draw a landmark dot
function drawLandmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius: number
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, 2 * Math.PI)
  ctx.fill()
}

