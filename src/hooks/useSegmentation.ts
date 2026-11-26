import { useCallback, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import type { LayerItem } from '../types'

function generateId(prefix = 'layer') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Multi-scale pyramid diffusion inpainting.
 * Reconstructs missing background pixels where `mask[i] === 1` while
 * keeping all unmasked (`mask[i] === 0`) original pixels untouched.
 */
function inpaintBackground(
  origData: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number
): ImageData {
  const maxDim = 320
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const sw = Math.max(16, Math.round(width * scale))
  const sh = Math.max(16, Math.round(height * scale))

  const sR = new Float32Array(sw * sh)
  const sG = new Float32Array(sw * sh)
  const sB = new Float32Array(sw * sh)
  const sKnown = new Uint8Array(sw * sh)

  for (let y = 0; y < sh; y++) {
    const oy = Math.min(height - 1, Math.floor((y / sh) * height))
    for (let x = 0; x < sw; x++) {
      const ox = Math.min(width - 1, Math.floor((x / sw) * width))
      const oi = oy * width + ox
      const si = y * sw + x
      if (mask[oi] === 0) {
        sKnown[si] = 1
        sR[si] = origData[oi * 4]
        sG[si] = origData[oi * 4 + 1]
        sB[si] = origData[oi * 4 + 2]
      }
    }
  }

  const nextR = new Float32Array(sR)
  const nextG = new Float32Array(sG)
  const nextB = new Float32Array(sB)
  const nextKnown = new Uint8Array(sKnown)

  const dx = [-1, 0, 1, -1, 1, -1, 0, 1]
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1]
  const dw = [0.7, 1, 0.7, 1, 1, 0.7, 1, 0.7]

  let remaining = 1
  let iter = 0
  while (remaining > 0 && iter < Math.max(sw, sh)) {
    remaining = 0
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const si = y * sw + x
        if (sKnown[si] === 1) continue

        let sumW = 0
        let r = 0
        let g = 0
        let b = 0
        for (let k = 0; k < 8; k++) {
          const nx = x + dx[k]
          const ny = y + dy[k]
          if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
            const ni = ny * sw + nx
            if (sKnown[ni] === 1) {
              const w = dw[k]
              sumW += w
              r += sR[ni] * w
              g += sG[ni] * w
              b += sB[ni] * w
            }
          }
        }

        if (sumW > 0) {
          nextR[si] = r / sumW
          nextG[si] = g / sumW
          nextB[si] = b / sumW
          nextKnown[si] = 1
        } else {
          remaining++
        }
      }
    }
    sR.set(nextR)
    sG.set(nextG)
    sB.set(nextB)
    sKnown.set(nextKnown)
    iter++
  }

  for (let pass = 0; pass < 8; pass++) {
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const oy = Math.min(height - 1, Math.floor((y / sh) * height))
        const ox = Math.min(width - 1, Math.floor((x / sw) * width))
        if (mask[oy * width + ox] === 0) continue

        const si = y * sw + x
        let sumW = 0
        let r = 0
        let g = 0
        let b = 0
        for (let k = 0; k < 8; k++) {
          const ni = (y + dy[k]) * sw + (x + dx[k])
          const w = dw[k]
          sumW += w
          r += sR[ni] * w
          g += sG[ni] * w
          b += sB[ni] * w
        }
        nextR[si] = r / sumW
        nextG[si] = g / sumW
        nextB[si] = b / sumW
      }
    }
    sR.set(nextR)
    sG.set(nextG)
    sB.set(nextB)
  }

  const out = new ImageData(width, height)
  const outData = out.data

  for (let y = 0; y < height; y++) {
    const sy = (y / height) * (sh - 1)
    const y0 = Math.floor(sy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const fy = sy - y0

    for (let x = 0; x < width; x++) {
      const oi = y * width + x
      const p = oi * 4

      if (mask[oi] === 0) {
        outData[p] = origData[p]
        outData[p + 1] = origData[p + 1]
        outData[p + 2] = origData[p + 2]
        outData[p + 3] = 255
        continue
      }

      const sx = (x / width) * (sw - 1)
      const x0 = Math.floor(sx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const fx = sx - x0

      const i00 = y0 * sw + x0
      const i10 = y0 * sw + x1
      const i01 = y1 * sw + x0
      const i11 = y1 * sw + x1

      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy

      outData[p] = Math.round(sR[i00] * w00 + sR[i10] * w10 + sR[i01] * w01 + sR[i11] * w11)
      outData[p + 1] = Math.round(sG[i00] * w00 + sG[i10] * w10 + sG[i01] * w01 + sG[i11] * w11)
      outData[p + 2] = Math.round(sB[i00] * w00 + sB[i10] * w10 + sB[i01] * w01 + sB[i11] * w11)
      outData[p + 3] = 255
    }
  }

  return out
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask
  const out = new Uint8Array(mask)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 1) {
        const y0 = Math.max(0, y - radius)
        const y1 = Math.min(height - 1, y + radius)
        const x0 = Math.max(0, x - radius)
        const x1 = Math.min(width - 1, x + radius)
        for (let ny = y0; ny <= y1; ny++) {
          for (let nx = x0; nx <= x1; nx++) {
            out[ny * width + nx] = 1
          }
        }
      }
    }
  }
  return out
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
    cropCtx.putImageData(cropImg, 0, 0)

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
 * Residual Graphic / Shape Element Detection (inspired by ReDesign / psdfy):
 * Finds compact, sharp-edged visual elements (logos, badges, shapes, icons)
 * in the unmasked residual image, extracts them with clean local alpha,
 * and marks them for background inpainting.
 */
function extractResidualElements(
  origData: Uint8ClampedArray,
  existingMask: Uint8Array,
  width: number,
  height: number
): { layers: LayerItem[]; mask: Uint8Array } {
  const gw = Math.min(240, width)
  const gh = Math.max(16, Math.round((height / width) * gw))

  // Compute grayscale + border color on downscaled grid
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

  // Sobel edge magnitude on unmasked regions
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
      const mag = Math.sqrt(gx * gx + gy * gy)
      if (mag > 85) {
        edgeBinary[i] = 1
      }
    }
  }

  // Close small gaps to group sharp graphic shapes/logos
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
        // Keep compact graphic elements (0.6% to 18% of canvas, not giant full-bg textures)
        if (boxArea >= totalArea * 0.006 && boxArea <= totalArea * 0.18 && area / boxArea > 0.28) {
          candidates.push({ id: currentLabel, minX, minY, maxX, maxY, area: boxArea })
        }
      }
    }
  }

  candidates.sort((a, b) => b.area - a.area)
  const topCandidates = candidates.slice(0, 4)

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
    if (bw < 16 || bh < 16) continue

    // Estimate local border background color
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
        if (dist > 32) {
          const dst = (y * bw + x) * 4
          out[dst] = origData[p]
          out[dst + 1] = origData[p + 1]
          out[dst + 2] = origData[p + 2]
          out[dst + 3] = Math.min(255, Math.round((dist - 32) * 4))
          addedMask[oi] = 1
          fgPixels++
        }
      }
    }

    if (fgPixels < bw * bh * 0.12) continue
    cropCtx.putImageData(cropImg, 0, 0)

    layers.push({
      id: generateId('elem'),
      name: `Element ${i + 1}`,
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

/**
 * Sample text ink color and mark ink pixels inside the bounding box for background inpainting.
 */
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
        const origImageData = origCtx.getImageData(0, 0, width, height)
        const origData = origImageData.data

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
              if (key.includes('fetch') || key.includes('download')) {
                setProcessing({
                  status: 'loading-model',
                  message: 'Magic start…',
                  percentage: Math.min(40, Math.round(8 + pct * 0.32)),
                })
              } else {
                setProcessing({
                  status: 'processing',
                  message: 'Magic happening…',
                  percentage: Math.min(55, Math.round(40 + pct * 0.15)),
                })
              }
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
          console.warn('AI segmentation unavailable:', aiErr)
        }

        if (abortRef.current) return false

        // Step 2: Separate salient foreground objects
        setProcessing({
          status: 'processing',
          message: 'Magic doing…',
          percentage: 62,
        })

        let objectLayers: LayerItem[] = []
        let combinedMask: Uint8Array = new Uint8Array(width * height)

        if (fgData) {
          for (let i = 0; i < width * height; i++) {
            if (fgData[i * 4 + 3] > 28) {
              combinedMask[i] = 1
            }
          }
          objectLayers = extractForegroundObjects(fgData, origData, width, height)
        }

        // Step 3: Residual graphic/shape element extraction
        setProcessing({
          status: 'processing',
          message: 'Magic happening…',
          percentage: 72,
        })
        const residual = extractResidualElements(origData, combinedMask, width, height)
        const elementLayers = residual.layers
        combinedMask = residual.mask

        // Step 4: OCR Text Extraction + Text Ink Masking
        setProcessing({
          status: 'processing',
          message: 'Magic doing…',
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
          ...elementLayers,
          ...objectLayers,
          ...textLayers,
        ]

        pushHistory()
        setLayers(allLayers)

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
    [setProcessing, setLayers, setCanvasSize, setOriginalImageUrl, pushHistory]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
    setProcessing({ status: 'idle', message: '', percentage: 0 })
  }, [setProcessing])

  return { segmentImage, cancel }
}
