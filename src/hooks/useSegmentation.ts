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

/**
 * Refine raw ISNet alpha to eliminate faint background ghosts while keeping smooth anti-aliased edges.
 */
function refineAlpha(rawAlpha: number): number {
  if (rawAlpha < 24) return 0
  if (rawAlpha >= 230) return 255
  const t = (rawAlpha - 24) / (230 - 24)
  // Smoothstep curve tightens hazy edges without harsh stair-stepping
  const smooth = t * t * (3 - 2 * t)
  return Math.round(smooth * 255)
}

function extractForegroundObjects(
  fgData: Uint8ClampedArray,
  origData: Uint8ClampedArray,
  width: number,
  height: number
): { layers: LayerItem[]; mask: Uint8Array } {
  const gridMax = 380
  const scale = Math.min(1, gridMax / Math.max(width, height))
  const gw = Math.max(16, Math.round(width * scale))
  const gh = Math.max(16, Math.round(height * scale))

  // Core foreground mask (high confidence pixels only)
  const binary = new Uint8Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) {
    const oy = Math.min(height - 1, Math.floor((gy / gh) * height))
    for (let gx = 0; gx < gw; gx++) {
      const ox = Math.min(width - 1, Math.floor((gx / gw) * width))
      if (fgData[(oy * width + ox) * 4 + 3] >= 90) {
        binary[gy * gw + gx] = 1
      }
    }
  }

  // Slight bridge (1px) to keep closely connected body/object parts together
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

        // Ignore tiny noise specks (< 0.8% of image area)
        if (area >= gw * gh * 0.008) {
          components.push({ id: currentLabel, minX, minY, maxX, maxY, area })
        }
      }
    }
  }

  components.sort((a, b) => a.minX - b.minX)

  const layers: LayerItem[] = []
  const mask = new Uint8Array(width * height)
  const pad = Math.max(4, Math.round(6 / scale))

  for (let i = 0; i < components.length; i++) {
    const comp = components[i]
    const x0 = Math.max(0, Math.floor((comp.minX / gw) * width) - pad)
    const y0 = Math.max(0, Math.floor((comp.minY / gh) * height) - pad)
    const x1 = Math.min(width - 1, Math.ceil(((comp.maxX + 1) / gw) * width) + pad)
    const y1 = Math.min(height - 1, Math.ceil(((comp.maxY + 1) / gh) * height) + pad)

    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    if (bw < 16 || bh < 16) continue

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

        // Check 3x3 neighborhood on grid so anti-aliased fringe around core mask is included
        let belongs = labels[gy * gw + gx] === comp.id
        if (!belongs) {
          for (let dy = -1; dy <= 1 && !belongs; dy++) {
            const ngy = gy + dy
            if (ngy < 0 || ngy >= gh) continue
            for (let dx = -1; dx <= 1; dx++) {
              const ngx = gx + dx
              if (ngx >= 0 && ngx < gw && labels[ngy * gw + ngx] === comp.id) {
                belongs = true
                break
              }
            }
          }
        }

        if (!belongs) continue

        const srcIdx = (oy * width + ox) * 4
        const alpha = refineAlpha(fgData[srcIdx + 3])
        if (alpha > 12) {
          const dstIdx = (y * bw + x) * 4
          out[dstIdx] = origData[srcIdx]
          out[dstIdx + 1] = origData[srcIdx + 1]
          out[dstIdx + 2] = origData[srcIdx + 2]
          out[dstIdx + 3] = alpha
          hasVisiblePixels = true
          if (alpha >= 48) {
            mask[oy * width + ox] = 1
          }
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

  return { layers, mask }
}

/**
 * Extract cohesive graphic elements (logos, badges, UI cards) ONLY when they sit
 * on a uniform background (low border color variance), preventing noisy cutouts on photos.
 */
function extractResidualElements(
  origData: Uint8ClampedArray,
  existingMask: Uint8Array,
  width: number,
  height: number
): { layers: LayerItem[]; mask: Uint8Array } {
  const gw = Math.min(220, width)
  const gh = Math.max(16, Math.round((height / width) * gw))

  const gray = new Float32Array(gw * gh)
  const masked = new Uint8Array(gw * gh)
  for (let y = 0; y < gh; y++) {
    const oy = Math.min(height - 1, Math.floor((y / gh) * height))
    for (let x = 0; x < gw; x++) {
      const ox = Math.min(width - 1, Math.floor((x / gw) * width))
      const oi = oy * width + ox
      const p = oi * 4
      gray[y * gw + x] = 0.299 * origData[p] + 0.587 * origData[p + 1] + 0.114 * origData[p + 2]
      masked[y * gw + x] = existingMask[oi]
    }
  }

  const edgeBinary = new Uint8Array(gw * gh)
  for (let y = 1; y < gh - 1; y++) {
    for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x
      if (masked[i] === 1) continue
      const gx =
        -gray[(y - 1) * gw + (x - 1)] + gray[(y - 1) * gw + (x + 1)] -
        2 * gray[y * gw + (x - 1)] + 2 * gray[y * gw + (x + 1)] -
        gray[(y + 1) * gw + (x - 1)] + gray[(y + 1) * gw + (x + 1)]
      const gy =
        -gray[(y - 1) * gw + (x - 1)] - 2 * gray[(y - 1) * gw + x] - gray[(y - 1) * gw + (x + 1)] +
        gray[(y + 1) * gw + (x - 1)] + 2 * gray[(y + 1) * gw + x] + gray[(y + 1) * gw + (x + 1)]
      if (Math.sqrt(gx * gx + gy * gy) > 120) {
        edgeBinary[i] = 1
      }
    }
  }

  const closed = dilateMask(edgeBinary, gw, gh, 2)
  const labels = new Int32Array(gw * gh)
  const candidates: ComponentBox[] = []
  let currentLabel = 0

  const qx = new Int32Array(gw * gh)
  const qy = new Int32Array(gw * gh)

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = y * gw + x
      if (closed[idx] === 1 && labels[idx] === 0 && masked[idx] === 0) {
        currentLabel++
        let head = 0, tail = 0
        qx[tail] = x
        qy[tail] = y
        tail++
        labels[idx] = currentLabel

        let minX = x, minY = y, maxX = x, maxY = y, area = 0
        while (head < tail) {
          const cx = qx[head]
          const cy = qy[head]
          head++
          area++
          if (cx < minX) minX = cx
          if (cy < minY) minY = cy
          if (cx > maxX) maxX = cx
          if (cy > maxY) maxY = cy

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue
              const nx = cx + dx, ny = cy + dy
              if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
                const nIdx = ny * gw + nx
                if (closed[nIdx] === 1 && labels[nIdx] === 0 && masked[nIdx] === 0) {
                  labels[nIdx] = currentLabel
                  qx[tail] = nx
                  qy[tail] = ny
                  tail++
                }
              }
            }
          }
        }

        const boxArea = (maxX - minX + 1) * (maxY - minY + 1)
        const totalArea = gw * gh
        if (boxArea >= totalArea * 0.012 && boxArea <= totalArea * 0.16 && area / boxArea > 0.42) {
          candidates.push({ id: currentLabel, minX, minY, maxX, maxY, area: boxArea })
        }
      }
    }
  }

  candidates.sort((a, b) => b.area - a.area)
  const topCandidates = candidates.slice(0, 3)

  const addedMask = new Uint8Array(existingMask)
  const layers: LayerItem[] = []

  for (let i = 0; i < topCandidates.length; i++) {
    const comp = topCandidates[i]
    const x0 = Math.max(0, Math.floor((comp.minX / gw) * width))
    const y0 = Math.max(0, Math.floor((comp.minY / gh) * height))
    const x1 = Math.min(width - 1, Math.ceil(((comp.maxX + 1) / gw) * width))
    const y1 = Math.min(height - 1, Math.ceil(((comp.maxY + 1) / gh) * height))

    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    if (bw < 24 || bh < 24) continue

    // Compute mean & std-dev of the border pixels to verify uniform background
    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0
    for (let x = x0; x <= x1; x++) {
      for (const y of [y0, y1]) {
        const p = (y * width + x) * 4
        bgR += origData[p]
        bgG += origData[p + 1]
        bgB += origData[p + 2]
        bgCount++
      }
    }
    bgR /= Math.max(1, bgCount)
    bgG /= Math.max(1, bgCount)
    bgB /= Math.max(1, bgCount)

    let varSum = 0
    for (let x = x0; x <= x1; x++) {
      for (const y of [y0, y1]) {
        const p = (y * width + x) * 4
        varSum +=
          (origData[p] - bgR) ** 2 +
          (origData[p + 1] - bgG) ** 2 +
          (origData[p + 2] - bgB) ** 2
      }
    }
    const borderStdDev = Math.sqrt(varSum / Math.max(1, bgCount))
    // Skip textured photographic regions (sky/buildings/trees) so we don't make noisy Swiss-cheese cutouts
    if (borderStdDev > 22) continue

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = bw
    cropCanvas.height = bh
    const cropCtx = cropCanvas.getContext('2d')!
    const cropImg = cropCtx.createImageData(bw, bh)
    const out = cropImg.data

    let fgPixels = 0
    for (let y = 0; y < bh; y++) {
      const oy = y0 + y
      for (let x = 0; x < bw; x++) {
        const ox = x0 + x
        const oi = oy * width + ox
        if (existingMask[oi] === 1) continue
        const p = oi * 4
        const dist = Math.sqrt(
          (origData[p] - bgR) ** 2 +
          (origData[p + 1] - bgG) ** 2 +
          (origData[p + 2] - bgB) ** 2
        )
        if (dist > 36) {
          const dst = (y * bw + x) * 4
          out[dst] = origData[p]
          out[dst + 1] = origData[p + 1]
          out[dst + 2] = origData[p + 2]
          out[dst + 3] = Math.min(255, Math.round((dist - 36) * 4.5))
          addedMask[oi] = 1
          fgPixels++
        }
      }
    }

    if (fgPixels < bw * bh * 0.15) continue
    cropCtx.putImageData(decontaminateEdges(cropImg), 0, 0)

    layers.push({
      id: generateId('elem'),
      name: `Element ${layers.length + 1}`,
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

  return { layers, mask: addedMask }
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

  let bgVar = 0
  for (let x = cx0; x <= cx1; x++) {
    for (const y of [cy0, cy1]) {
      const i = (y * width + x) * 4
      bgVar += (origData[i] - bgR) ** 2 + (origData[i + 1] - bgG) ** 2 + (origData[i + 2] - bgB) ** 2
    }
  }
  const bgStdDev = Math.sqrt(bgVar / Math.max(1, bgCount))

  let maxDist = -1
  let bestR = 0, bestG = 0, bestB = 0
  let inkCount = 0
  const totalPixels = Math.max(1, (cx1 - cx0 + 1) * (cy1 - cy0 + 1))

  const candidateInk: number[] = []
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const oi = y * width + x
      const i = oi * 4
      const dist = Math.sqrt(
        (origData[i] - bgR) ** 2 +
        (origData[i + 1] - bgG) ** 2 +
        (origData[i + 2] - bgB) ** 2
      )
      if (dist > 40) {
        candidateInk.push(oi)
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

  const inkRatio = inkCount / totalPixels
  if (bgStdDev < 45 && inkRatio >= 0.04 && inkRatio <= 0.65) {
    for (const oi of candidateInk) {
      mask[oi] = 1
    }
  }

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return {
    fill: `#${toHex(bestR)}${toHex(bestG)}${toHex(bestB)}`,
    isBold: inkRatio > 0.28,
  }
}

export function useSegmentation() {
  const { setProcessing, setLayers, setSelectedLayerId, setCanvasSize, setOriginalImageUrl, pushHistory } =
    useEditorStore()
  const abortRef = useRef(false)

  const segmentImage = useCallback(
    async (file: File): Promise<boolean> => {
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

        const origCanvas = document.createElement('canvas')
        origCanvas.width = width
        origCanvas.height = height
        const origCtx = origCanvas.getContext('2d')!
        origCtx.drawImage(img, 0, 0)
        const origData = origCtx.getImageData(0, 0, width, height).data

        // Step 1: AI Foreground Segmentation (ISNet)
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
                message: key.includes('fetch') || key.includes('download') ? 'Magic start…' : 'Magic doing…',
                percentage: Math.min(55, Math.round(10 + pct * 0.45)),
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

        // Step 2: Separate salient foreground objects
        setProcessing({
          status: 'processing',
          message: 'Magic happening…',
          percentage: 62,
        })

        let objectLayers: LayerItem[] = []
        let combinedMask: Uint8Array = new Uint8Array(width * height)

        if (fgData) {
          const extracted = extractForegroundObjects(fgData, origData, width, height)
          objectLayers = extracted.layers
          combinedMask = extracted.mask
        }

        // Step 3: Residual graphic/shape element extraction (uniform-background badges/logos only)
        const residual = extractResidualElements(origData, combinedMask, width, height)
        const elementLayers = residual.layers
        combinedMask = residual.mask

        // Step 4: OCR Text Extraction + Text Ink Masking
        setProcessing({
          status: 'processing',
          message: 'Magic doing…',
          percentage: 78,
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
            if (!cleanText || line.confidence < 72 || cleanText.length > 80) continue
            if (!/[a-zA-Z0-9]{2,}/.test(cleanText)) continue

            const { x0, y0, x1, y1 } = line.bbox
            const boxW = Math.round(x1 - x0)
            const boxH = Math.round(y1 - y0)
            if (boxW < 16 || boxH < 12) continue
            if (boxW > width * 0.85 && boxH > height * 0.5) continue

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

        // Step 5: Reconstruct Background behind all objects, elements, and text
        setProcessing({
          status: 'processing',
          message: 'Magic happening…',
          percentage: 92,
        })
        await new Promise((r) => setTimeout(r, 20))

        const dilatedMask = dilateMask(combinedMask, width, height, 3)
        const hasMaskPixels = dilatedMask.some((v) => v === 1)

        const bgCanvas = document.createElement('canvas')
        bgCanvas.width = width
        bgCanvas.height = height
        const bgCtx = bgCanvas.getContext('2d')!

        if (hasMaskPixels && (objectLayers.length > 0 || elementLayers.length > 0 || textLayers.length > 0)) {
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
          locked: true, // Lock background by default like Canva so objects are easy to drag
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
          ...elementLayers,
          ...objectLayers,
          ...textLayers,
        ]

        pushHistory()
        setLayers(allLayers)

        // Auto-select the first foreground object or text layer
        const firstEditable = objectLayers[0] ?? elementLayers[0] ?? textLayers[0]
        if (firstEditable) setSelectedLayerId(firstEditable.id)

        const totalExtracted = objectLayers.length + elementLayers.length
        setProcessing({
          status: 'done',
          message: `Separated ${totalExtracted} layer${totalExtracted !== 1 ? 's' : ''}${
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
    [setProcessing, setLayers, setSelectedLayerId, setCanvasSize, setOriginalImageUrl, pushHistory]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
    setProcessing({ status: 'idle', message: '', percentage: 0 })
  }, [setProcessing])

  return { segmentImage, cancel }
}
