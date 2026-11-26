import { writePsdBuffer, type Layer, type Psd } from 'ag-psd'
import type { LayerItem } from '../types'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Render a LayerItem into an HTMLCanvasElement for PSD raster layer embedding.
 */
async function layerToCanvas(layer: LayerItem): Promise<HTMLCanvasElement> {
  const w = Math.max(1, Math.round(layer.width))
  const h = Math.max(1, Math.round(layer.height))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  if (layer.type === 'image' && layer.imageData) {
    const img = await loadImage(layer.imageData)
    ctx.drawImage(img, 0, 0, w, h)
  } else if (layer.type === 'text') {
    const fontSize = layer.fontSize ?? 16
    const fontFamily = layer.fontFamily ?? 'Inter, sans-serif'
    const fontWeight = layer.fontWeight === 'bold' ? 'bold' : 'normal'
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    ctx.fillStyle = layer.fill ?? '#000000'
    ctx.textBaseline = 'top'
    const align = layer.textAlign ?? 'left'
    ctx.textAlign = align
    const drawX = align === 'center' ? w / 2 : align === 'right' ? w : 0
    const lines = (layer.text ?? '').split('\n')
    const lineHeight = fontSize * 1.2
    lines.forEach((line, idx) => {
      ctx.fillText(line, drawX, idx * lineHeight, w)
    })
  }

  return canvas
}

/**
 * Export all layers to a real, multi-layered Adobe Photoshop (.psd) Blob.
 */
export async function exportLayersToPsd(
  layers: LayerItem[],
  canvasWidth: number,
  canvasHeight: number
): Promise<Blob> {
  const children: Layer[] = []

  for (const layer of layers) {
    const canvas = await layerToCanvas(layer)
    const psdLayer: Layer = {
      name: layer.name,
      left: Math.round(layer.x),
      top: Math.round(layer.y),
      opacity: Math.max(0, Math.min(1, layer.opacity)),
      hidden: !layer.visible,
      canvas,
    }

    if (layer.type === 'text' && layer.text) {
      const rgb = hexToRgb(layer.fill ?? '#000000')
      psdLayer.text = {
        text: layer.text,
        transform: [1, 0, 0, 1, Math.round(layer.x), Math.round(layer.y + (layer.fontSize ?? 16))],
        style: {
          fontSize: layer.fontSize ?? 16,
          fillColor: rgb,
        },
      }
    }

    children.push(psdLayer)
  }

  const psd: Psd = {
    width: Math.max(1, Math.round(canvasWidth)),
    height: Math.max(1, Math.round(canvasHeight)),
    children,
  }

  const buffer = writePsdBuffer(psd)
  return new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' })
}
