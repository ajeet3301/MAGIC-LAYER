import { useCallback, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import type { LayerItem, SegmentedObject } from '../types'

function generateId() {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Canvas-based image segmentation using edge detection + color clustering.
 * This is a client-side, no-AI fallback that works on all devices.
 * It analyzes the image using pixel data to identify distinct visual regions.
 */
function clusterImageRegions(
  canvas: HTMLCanvasElement,
  numRegions: number = 4
): SegmentedObject[] {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // Sample pixels at regular intervals to find dominant colors
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 1000)))
  const colorSamples: number[][] = []

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      colorSamples.push([data[i], data[i + 1], data[i + 2]])
    }
  }

  // Simple k-means clustering to find color groups
  const k = Math.min(numRegions, 6)
  const centroids = colorSamples
    .sort(() => Math.random() - 0.5)
    .slice(0, k)
    .map((c) => [...c])

  // 5 iterations of k-means
  for (let iter = 0; iter < 5; iter++) {
    const clusters: number[][][] = Array.from({ length: k }, () => [])

    for (const sample of colorSamples) {
      let minDist = Infinity
      let nearest = 0
      for (let j = 0; j < k; j++) {
        const d =
          (sample[0] - centroids[j][0]) ** 2 +
          (sample[1] - centroids[j][1]) ** 2 +
          (sample[2] - centroids[j][2]) ** 2
        if (d < minDist) {
          minDist = d
          nearest = j
        }
      }
      clusters[nearest].push(sample)
    }

    for (let j = 0; j < k; j++) {
      if (clusters[j].length > 0) {
        centroids[j] = [
          clusters[j].reduce((s, c) => s + c[0], 0) / clusters[j].length,
          clusters[j].reduce((s, c) => s + c[1], 0) / clusters[j].length,
          clusters[j].reduce((s, c) => s + c[2], 0) / clusters[j].length,
        ]
      }
    }
  }

  // Create masked canvases for each cluster
  const results: SegmentedObject[] = []
  const threshold = 60

  for (let j = 0; j < k; j++) {
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = width
    maskCanvas.height = height
    const maskCtx = maskCanvas.getContext('2d')!
    const maskData = maskCtx.createImageData(width, height)

    let minX = width, minY = height, maxX = 0, maxY = 0
    let pixelCount = 0

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]

        const dist = Math.sqrt(
          (r - centroids[j][0]) ** 2 +
          (g - centroids[j][1]) ** 2 +
          (b - centroids[j][2]) ** 2
        )

        if (dist < threshold && a > 10) {
          maskData.data[i] = r
          maskData.data[i + 1] = g
          maskData.data[i + 2] = b
          maskData.data[i + 3] = a
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
          pixelCount++
        }
      }
    }

    // Skip very small regions (less than 2% of image)
    if (pixelCount < (width * height * 0.02)) continue
    if (minX >= maxX || minY >= maxY) continue

    maskCtx.putImageData(maskData, 0, 0)

    const bboxW = maxX - minX + 1
    const bboxH = maxY - minY + 1

    // Crop to bounding box
    const croppedCanvas = document.createElement('canvas')
    croppedCanvas.width = bboxW
    croppedCanvas.height = bboxH
    croppedCanvas.getContext('2d')!.drawImage(maskCanvas, minX, minY, bboxW, bboxH, 0, 0, bboxW, bboxH)

    const layerNames = ['Background', 'Foreground', 'Accent', 'Highlight', 'Detail', 'Shadow']

    results.push({
      id: generateId(),
      name: layerNames[j] ?? `Region ${j + 1}`,
      maskData: maskData.data,
      bbox: { x: minX, y: minY, width: bboxW, height: bboxH },
      imageDataUrl: croppedCanvas.toDataURL('image/png'),
    })
  }

  return results
}

/**
 * Also create a "full image" base layer
 */
function createFullImageLayer(canvas: HTMLCanvasElement, name: string): SegmentedObject {
  return {
    id: generateId(),
    name,
    maskData: new Uint8ClampedArray(canvas.width * canvas.height * 4),
    bbox: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    imageDataUrl: canvas.toDataURL('image/png'),
  }
}

export function useSegmentation() {
  const { setProcessing, setLayers, setCanvasSize, setOriginalImageUrl, pushHistory } =
    useEditorStore()
  const abortRef = useRef(false)

  const segmentImage = useCallback(
    async (file: File): Promise<boolean> => {
      abortRef.current = false

      try {
        setProcessing({
          status: 'processing',
          message: 'Analyzing image…',
          percentage: 10,
        })

        // Load image into canvas
        const imageUrl = URL.createObjectURL(file)
        setOriginalImageUrl(imageUrl)

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = imageUrl
        })

        if (abortRef.current) return false

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)

        setCanvasSize(img.naturalWidth, img.naturalHeight)

        setProcessing({
          status: 'processing',
          message: 'Detecting visual regions…',
          percentage: 30,
        })

        await new Promise((r) => setTimeout(r, 50)) // yield to browser

        if (abortRef.current) return false

        setProcessing({
          status: 'processing',
          message: 'Clustering color regions…',
          percentage: 55,
        })

        const segments = clusterImageRegions(canvas, 5)

        if (abortRef.current) return false

        setProcessing({
          status: 'processing',
          message: 'Building layers…',
          percentage: 80,
        })

        // Build layers from segments
        // Add a full composite base layer first
        const baseLayer = createFullImageLayer(canvas, 'Original Image')

        const allLayers: LayerItem[] = [
          // Full image as bottom layer
          {
            id: baseLayer.id,
            name: baseLayer.name,
            type: 'image',
            visible: true,
            locked: false,
            opacity: 1,
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            rotation: 0,
            imageData: baseLayer.imageDataUrl,
          },
          // Individual segments
          ...segments.map((seg, i) => ({
            id: seg.id,
            name: seg.name,
            type: 'image' as const,
            visible: i === 0, // Show only first segment initially
            locked: false,
            opacity: 1,
            x: seg.bbox.x,
            y: seg.bbox.y,
            width: seg.bbox.width,
            height: seg.bbox.height,
            rotation: 0,
            imageData: seg.imageDataUrl,
          })),
        ]

        pushHistory()
        setLayers(allLayers)

        setProcessing({
          status: 'done',
          message: `Detected ${segments.length} visual layers!`,
          percentage: 100,
        })

        return true
      } catch (err: unknown) {
        console.error('Segmentation error:', err)
        setProcessing({
          status: 'error',
          message: `Error: ${err instanceof Error ? err.message : 'Segmentation failed'}`,
          percentage: 0,
        })
        return false
      }
    },
    [setProcessing, setLayers, setCanvasSize, setOriginalImageUrl, pushHistory]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
    setProcessing({ status: 'idle', message: '', percentage: 0 })
  }, [setProcessing])

  return { segmentImage, cancel }
}
