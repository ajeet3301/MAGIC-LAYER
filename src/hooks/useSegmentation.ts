import { useCallback, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import { decontaminateEdges, dilateMask, inpaintBackground } from '../utils/inpaint'
import type { LayerItem } from '../types'

function generateId(prefix = 'layer') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface ComponentBox {
  id: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  area: number
}

function extractForegroundObjects(
  fgData: Uint8ClampedArray,
  origData: Uint8ClampedArray,
  width: number,
  height: number
): LayerItem[] {
  const gridMax = 360
  const scale = Math.min(1, gridMax / Math.max(width, height))
  const gw = Math.max(16, Math.round(width * scale))
  const gh = Math.max(16, Math.round(height * scale))

  const binary = new Uint8Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) {
    const oy = Math.min(height - 1, Math.floor((gy / gh) * height))
    for (let gx = 0; gx < gw; gx++) {
      const ox = Math.min(width - 1, Math.floor((gx / gw) * width))
      if (fgData[(oy * width + ox) * 4 + 3] > 28) {
        binary[gy * gw + gx] = 1
      }
    }
  }

  const bridged = dilateMask(binary, gw, gh, 1)
  const labels = new Int32Array(gw * gh)
  const components: ComponentBox[] = []
  let currentLabel = 0

  const queueX = new Int32Array(gw * gh)
  const queueY = new Int32Array(gw * gh)

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = y * gw + x
      if (bridged[idx] === 1 && labels[idx] === 0) {
        currentLabel++
        let head = 0
        let tail = 0
        queueX[tail] = x
        queueY[tail] = y
        tail++
        labels[idx] = currentLabel

        let minX = x, minY = y, maxX = x, maxY = y, area = 0

        while (head < tail) {
          const cx = queueX[head]
          const cy = queueY[head]
          head++
          if (binary[cy * gw + cx] === 1) area++
          if (cx < minX) minX = cx
          if (cy < minY) minY = cy
          if (cx > maxX) maxX = cx
          if (cy > maxY) maxY = cy

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue
              const nx = cx + dx
              const ny = cy + dy
              if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
                const nIdx = ny * gw + nx
                if (bridged[nIdx] === 1 && labels[nIdx] === 0) {
                  labels[nIdx] = currentLabel
                  queueX[tail] = nx
                  queueY[tail] = ny
                  tail++
                }
              }
            }
          }
        }

        if (area >= gw * gh * 0.0025) {
          components.push({ id: currentLabel, minX, minY, maxX, maxY, area })
        }
      }
    }
  }

  components.sort((a, b) => a.minX - b.minX)

  const layers: LayerItem[] = []
  const pad = Math.max(2, Math.round(4 / scale))

  for (let i = 0; i < components.length; i++) {
    const comp = components[i]
    const x0 = Math.max(0, Math.floor((comp.minX / gw) * width) - pad)
    const y0 = Math.max(0, Math.floor((comp.minY / gh) * height) - pad)
    const x1 = Math.min(width - 1, Math.ceil(((comp.maxX + 1) / gw) * width) + pad)
    const y1 = Math.min(height - 1, Math.ceil(((comp.maxY + 1) / gh) * height) + pad)

    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    if (bw < 4 || bh < 4) continue

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = bw
    cropCanvas.height = bh
    const cropCtx = cropCanvas.getContext('2d')!
    const cropImg = cropCtx.createImageData(bw, bh)
    const out = cropImg.data

    let hasVisiblePixels = false
    for (let y = 0; y < bh; y++) {
      const oy = y0 + y
      const gy = Math.min(gh - 1, Math.floor((oy / height) * gh))
      for (let x = 0; x < bw; x++) {
        const ox = x0 + x
        const gx = Math.min(gw - 1, Math.floor((ox / width) * gw))
        const label = labels[gy * gw + gx]

        const srcIdx = (oy * width + ox) * 4
        const dstIdx = (y * bw + x) * 4
        const alpha = fgData[srcIdx + 3]

        if (label === comp.id && alpha > 12) {
          out[dstIdx] = origData[srcIdx]
          out[dstIdx + 1] = origData[srcIdx + 1]
          out[dstIdx + 2] = origData[srcIdx + 2]
          out[dstIdx + 3] = alpha
          hasVisiblePixels = true
        }
      }
    }

    if (!hasVisiblePixels) continue
    cropCtx.putImageData(decontaminateEdges(cropImg), 0, 0)

    layers.push({
      id: generateId('obj'),
      name: components.length === 1 ? 'Subject' : `Object ${i + 1}`,
      type: 'image',
      visible: true,
      locked: false,
      opacity: 1,
      x: x0,
      y: y0,
      width: bw,
      height: bh,
      rotation: 0,
      imageData: cropCanvas.toDataURL('image/png'),
    })
  }

  return layers
}

/**
 * Crop a full-canvas RGBA image URL (e.g. from Qwen-Image-Layered) to its tight
 * non-transparent bounding box and scale to target canvas dimensions.
 */
async function processQwenLayer(
  url: string,
  index: number,
  targetWidth: number,
  targetHeight: number
): Promise<LayerItem | null> {
  const res = await fetch(url)
  const blob = await res.blob()
  const localUrl = URL.createObjectURL(blob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = localUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    // Bottom layer (index 0) is typically the background
    if (index === 0) {
      return {
        id: generateId('qwen-bg'),
        name: 'Background',
        type: 'image',
        visible: true,
        locked: false,
        opacity: 1,
        x: 0,
        y: 0,
        width: targetWidth,
        height: targetHeight,
        rotation: 0,
        imageData: canvas.toDataURL('image/png'),
      }
    }

    const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight)
    let minX = targetWidth, minY = targetHeight, maxX = 0, maxY = 0
    let opaqueCount = 0

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const a = data[(y * targetWidth + x) * 4 + 3]
        if (a > 12) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
          opaqueCount++
        }
      }
    }

    if (opaqueCount < 16 || minX >= maxX || minY >= maxY) return null

    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = bw
    cropCanvas.height = bh
    cropCanvas.getContext('2d')!.drawImage(canvas, minX, minY, bw, bh, 0, 0, bw, bh)

    return {
      id: generateId('qwen-layer'),
      name: `Layer ${index}`,
      type: 'image',
      visible: true,
      locked: false,
      opacity: 1,
      x: minX,
      y: minY,
      width: bw,
      height: bh,
      rotation: 0,
      imageData: cropCanvas.toDataURL('image/png'),
    }
  } finally {
    URL.revokeObjectURL(localUrl)
  }
}

function analyzeAndMaskText(
  origData: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { fill: string; isBold: boolean } {
  const cx0 = Math.max(0, Math.floor(x0))
  const cy0 = Math.max(0, Math.floor(y0))
  const cx1 = Math.min(width - 1, Math.ceil(x1))
  const cy1 = Math.min(height - 1, Math.ceil(y1))

  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0
  for (let x = cx0; x <= cx1; x++) {
    for (const y of [cy0, cy1]) {
      const i = (y * width + x) * 4
      bgR += origData[i]
      bgG += origData[i + 1]
      bgB += origData[i + 2]
      bgCount++
    }
  }
  if (bgCount > 0) {
    bgR /= bgCount
    bgG /= bgCount
    bgB /= bgCount
  }

  let maxDist = -1
  let bestR = 0, bestG = 0, bestB = 0
  let inkCount = 0
  const totalPixels = Math.max(1, (cx1 - cx0 + 1) * (cy1 - cy0 + 1))

  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const oi = y * width + x
      const i = oi * 4
      const dist = Math.sqrt(
        (origData[i] - bgR) ** 2 +
        (origData[i + 1] - bgG) ** 2 +
        (origData[i + 2] - bgB) ** 2
      )
      if (dist > 38) {
        mask[oi] = 1
        inkCount++
      }
      if (dist > maxDist) {
        maxDist = dist
        bestR = origData[i]
        bestG = origData[i + 1]
        bestB = origData[i + 2]
      }
    }
  }

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return {
    fill: `#${toHex(bestR)}${toHex(bestG)}${toHex(bestB)}`,
    isBold: inkCount / totalPixels > 0.28,
  }
}

export function useSegmentation() {
  const { setProcessing, setLayers, setCanvasSize, setOriginalImageUrl, pushHistory } =
    useEditorStore()
  const abortRef = useRef(false)

  const segmentImage = useCallback(
    async (file: File, targetLayers = 4): Promise<boolean> => {
      abortRef.current = false

      try {
        setProcessing({
          status: 'loading-model',
          message: 'Magic starting…',
          percentage: 8,
        })

        const imageUrl = URL.createObjectURL(file)
        setOriginalImageUrl(imageUrl)

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = imageUrl
        })

        if (abortRef.current) return false

        const width = img.naturalWidth
        const height = img.naturalHeight
        setCanvasSize(width, height)

        // Primary: Qwen/Qwen-Image-Layered via public Gradio Space (free, no API key)
        try {
          setProcessing({
            status: 'processing',
            message: 'Magic start…',
            percentage: 20,
          })

          const { Client, handle_file } = await import('@gradio/client')
          const client = await Client.connect('Qwen/Qwen-Image-Layered')

          if (abortRef.current) return false

          setProcessing({
            status: 'processing',
            message: 'Magic happening…',
            percentage: 45,
          })

          const prediction = (await Promise.race([
            client.predict('/infer_1', {
              input_image: handle_file(file),
              seed: 0,
              randomize_seed: true,
              prompt: '',
              neg_prompt: ' ',
              true_guidance_scale: 4.0,
              num_inference_steps: 28,
              layer: Math.max(2, Math.min(10, targetLayers)),
              cfg_norm: true,
              use_en_prompt: true,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Qwen Space timeout')), 90000)
            ),
          ])) as { data: unknown[] }

          if (abortRef.current) return false

          const gallery = Array.isArray(prediction?.data?.[0])
            ? (prediction.data[0] as Array<{ image?: { url?: string } }>)
            : []

          if (gallery.length >= 2) {
            setProcessing({
              status: 'processing',
              message: 'Magic doing…',
              percentage: 80,
            })

            const qwenLayers: LayerItem[] = []
            for (let i = 0; i < gallery.length; i++) {
              const url = gallery[i]?.image?.url
              if (!url) continue
              const item = await processQwenLayer(url, i, width, height)
              if (item) qwenLayers.push(item)
            }

            if (qwenLayers.length >= 2) {
              pushHistory()
              setLayers(qwenLayers)
              setProcessing({
                status: 'done',
                message: `Separated ${qwenLayers.length} layers`,
                percentage: 100,
              })
              return true
            }
          }
        } catch (qwenErr) {
          console.warn('Qwen-Image-Layered unavailable, using local fallback:', qwenErr)
        }

        if (abortRef.current) return false

        // Fallback: Local on-device pipeline (ISNet + OCR + Background Inpainting)
        const origCanvas = document.createElement('canvas')
        origCanvas.width = width
        origCanvas.height = height
        const origCtx = origCanvas.getContext('2d')!
        origCtx.drawImage(img, 0, 0)
        const origData = origCtx.getImageData(0, 0, width, height).data

        let fgData: Uint8ClampedArray | null = null
        try {
          const { removeBackground } = await import('@imgly/background-removal')
          const fgBlob = await removeBackground(file, {
            model: 'isnet_quint8',
            output: { format: 'image/png' },
            progress: (key: string, current: number, total: number) => {
              if (abortRef.current) return
              const pct = total > 0 ? Math.round((current / total) * 100) : 0
              setProcessing({
                status: key.includes('fetch') || key.includes('download') ? 'loading-model' : 'processing',
                message: 'Magic doing…',
                percentage: Math.min(65, Math.round(30 + pct * 0.35)),
              })
            },
          })

          if (abortRef.current) return false

          const fgUrl = URL.createObjectURL(fgBlob as Blob)
          const fgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = fgUrl
          })
          URL.revokeObjectURL(fgUrl)

          const fgCanvas = document.createElement('canvas')
          fgCanvas.width = width
          fgCanvas.height = height
          const fgCtx = fgCanvas.getContext('2d')!
          fgCtx.drawImage(fgImg, 0, 0, width, height)
          fgData = fgCtx.getImageData(0, 0, width, height).data
        } catch (aiErr) {
          console.warn('Local AI segmentation unavailable:', aiErr)
        }

        if (abortRef.current) return false

        let objectLayers: LayerItem[] = []
        const combinedMask = new Uint8Array(width * height)

        if (fgData) {
          for (let i = 0; i < width * height; i++) {
            if (fgData[i * 4 + 3] > 28) combinedMask[i] = 1
          }
          objectLayers = extractForegroundObjects(fgData, origData, width, height)
        }

        setProcessing({
          status: 'processing',
          message: 'Magic happening…',
          percentage: 82,
        })

        const textLayers: LayerItem[] = []
        try {
          const { createWorker } = await import('tesseract.js')
          const worker = await createWorker('eng', 1)
          const { data } = await worker.recognize(imageUrl, {}, { blocks: true })
          await worker.terminate()

          const lines = (data.blocks ?? []).flatMap((b) =>
            b.paragraphs.flatMap((p) => p.lines)
          )

          for (const line of lines) {
            const cleanText = line.text.trim()
            if (!cleanText || line.confidence < 60) continue
            const { x0, y0, x1, y1 } = line.bbox
            const boxW = Math.round(x1 - x0)
            const boxH = Math.round(y1 - y0)
            if (boxW < 12 || boxH < 10) continue

            const { fill, isBold } = analyzeAndMaskText(
              origData,
              combinedMask,
              width,
              height,
              x0,
              y0,
              x1,
              y1
            )

            textLayers.push({
              id: generateId('text'),
              name: `Text: "${cleanText.slice(0, 18)}${cleanText.length > 18 ? '…' : ''}"`,
              type: 'text',
              visible: true,
              locked: false,
              opacity: 1,
              x: Math.round(x0),
              y: Math.round(y0),
              width: Math.max(20, boxW),
              height: Math.max(16, boxH),
              rotation: 0,
              text: cleanText,
              fontSize: Math.max(12, Math.round(boxH * 0.78)),
              fontFamily: 'Inter, sans-serif',
              fontWeight: isBold ? 'bold' : '400',
              fill,
              textAlign: 'left',
              letterSpacing: 0,
            })
          }
        } catch (ocrErr) {
          console.warn('OCR step skipped:', ocrErr)
        }

        if (abortRef.current) return false

        const dilatedMask = dilateMask(combinedMask, width, height, 3)
        const hasMaskPixels = dilatedMask.some((v) => v === 1)

        const bgCanvas = document.createElement('canvas')
        bgCanvas.width = width
        bgCanvas.height = height
        const bgCtx = bgCanvas.getContext('2d')!

        if (hasMaskPixels && (objectLayers.length > 0 || textLayers.length > 0)) {
          const inpainted = inpaintBackground(origData, dilatedMask, width, height)
          bgCtx.putImageData(inpainted, 0, 0)
        } else {
          bgCtx.drawImage(origCanvas, 0, 0)
        }

        const backgroundLayer: LayerItem = {
          id: generateId('bg'),
          name: 'Background',
          type: 'image',
          visible: true,
          locked: false,
          opacity: 1,
          x: 0,
          y: 0,
          width,
          height,
          rotation: 0,
          imageData: bgCanvas.toDataURL('image/png'),
        }

        const allLayers: LayerItem[] = [
          backgroundLayer,
          ...objectLayers,
          ...textLayers,
        ]

        pushHistory()
        setLayers(allLayers)

        setProcessing({
          status: 'done',
          message: `Separated ${objectLayers.length} object${objectLayers.length !== 1 ? 's' : ''}${
            textLayers.length > 0 ? ` + ${textLayers.length} text` : ''
          }`,
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
