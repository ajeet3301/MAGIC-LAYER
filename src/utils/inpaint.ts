/**
 * Dilate a binary mask by `radius` pixels to avoid halo fringes during inpainting.
 */
export function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
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

/**
 * Multi-scale pyramid diffusion inpainting.
 * Reconstructs missing background pixels where `mask[i] === 1` while
 * keeping all unmasked (`mask[i] === 0`) original pixels untouched.
 */
export function inpaintBackground(
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
