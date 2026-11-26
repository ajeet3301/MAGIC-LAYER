import { useCallback, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import { decontaminateEdges, dilateMask, inpaintBackground } from '../utils/inpaint'
import type { LayerItem } from '../types'

const SAM_MODEL_ID = 'Xenova/slimsam-77-uniform'

let cachedModel: any = null
let cachedProcessor: any = null

export function useSAM() {
  const { layers, addLayer, updateLayer, setSelectedLayerId, setProcessing, pushHistory } =
    useEditorStore()

  const cachedImageSrcRef = useRef<string | null>(null)
  const cachedEmbeddingsRef = useRef<any>(null)
  const cachedInputsRef = useRef<any>(null)

  const extractAtPoint = useCallback(
    async (clickX: number, clickY: number): Promise<boolean> => {
      // Pick the Background layer (or bottom-most image layer) to segment from
      const bgLayer =
        layers.find((l) => l.name === 'Background' && l.type === 'image' && l.imageData) ??
        layers.find((l) => l.type === 'image' && l.imageData)

      if (!bgLayer || !bgLayer.imageData) return false

      try {
        if (!cachedModel || !cachedProcessor) {
          setProcessing({
            status: 'loading-model',
            message: 'Magic starting…',
            percentage: 15,
          })

          const { SamModel, AutoProcessor } = await import('@huggingface/transformers')
          const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

          cachedProcessor = await AutoProcessor.from_pretrained(SAM_MODEL_ID)
          cachedModel = await SamModel.from_pretrained(SAM_MODEL_ID, {
            device: hasWebGPU ? 'webgpu' : 'wasm',
            dtype: hasWebGPU ? 'fp16' : 'q8',
          })
        }

        const { RawImage } = await import('@huggingface/transformers')

        // Compute or reuse image embeddings for the current background image
        if (cachedImageSrcRef.current !== bgLayer.imageData || !cachedEmbeddingsRef.current) {
          setProcessing({
            status: 'processing',
            message: 'Magic start…',
            percentage: 45,
          })

          const rawImg = await RawImage.fromURL(bgLayer.imageData)
          const processed = await cachedProcessor(rawImg)
          const embeddings = await cachedModel.get_image_embeddings(processed)

          cachedImageSrcRef.current = bgLayer.imageData
          cachedInputsRef.current = processed
          cachedEmbeddingsRef.current = embeddings
        }

        setProcessing({
          status: 'processing',
          message: 'Magic doing…',
          percentage: 75,
        })

        // Map canvas coordinates to raw image pixel coordinates
        const rawImg = await RawImage.fromURL(bgLayer.imageData)
        const scaleToRawX = rawImg.width / Math.max(1, bgLayer.width)
        const scaleToRawY = rawImg.height / Math.max(1, bgLayer.height)
        const localX = Math.max(0, Math.min(rawImg.width - 1, (clickX - bgLayer.x) * scaleToRawX))
        const localY = Math.max(0, Math.min(rawImg.height - 1, (clickY - bgLayer.y) * scaleToRawY))

        const promptInputs = await cachedProcessor(rawImg, {
          input_points: [[[localX, localY]]],
          input_labels: [[1]],
        })

        const outputs = await cachedModel({
          ...cachedEmbeddingsRef.current,
          input_points: promptInputs.input_points,
          input_labels: promptInputs.input_labels,
        })

        const masks = await cachedProcessor.post_process_masks(
          outputs.pred_masks,
          cachedInputsRef.current.original_sizes,
          cachedInputsRef.current.reshaped_input_sizes
        )

        // Pick best mask by IoU score
        const scores: Float32Array = outputs.iou_scores.data
        let bestIdx = 0
        for (let i = 1; i < scores.length; i++) {
          if (scores[i] > scores[bestIdx]) bestIdx = i
        }

        const maskTensor = masks[0][0]
        const maskH = maskTensor.dims[1]
        const maskW = maskTensor.dims[2]
        const maskData: Uint8Array | Float32Array = maskTensor.data
        const offset = bestIdx * maskW * maskH

        setProcessing({
          status: 'processing',
          message: 'Magic happening…',
          percentage: 90,
        })

        // Load background image onto canvas to crop object & inpaint background
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image()
          el.onload = () => resolve(el)
          el.onerror = reject
          el.src = bgLayer.imageData!
        })

        const w = img.naturalWidth || Math.round(bgLayer.width)
        const h = img.naturalHeight || Math.round(bgLayer.height)
        const bgCanvas = document.createElement('canvas')
        bgCanvas.width = w
        bgCanvas.height = h
        const bgCtx = bgCanvas.getContext('2d')!
        bgCtx.drawImage(img, 0, 0, w, h)
        const origData = bgCtx.getImageData(0, 0, w, h).data

        const binaryMask = new Uint8Array(w * h)
        let minX = w, minY = h, maxX = 0, maxY = 0
        let count = 0

        for (let y = 0; y < h; y++) {
          const my = Math.min(maskH - 1, Math.floor((y / h) * maskH))
          for (let x = 0; x < w; x++) {
            const mx = Math.min(maskW - 1, Math.floor((x / w) * maskW))
            const val = maskData[offset + my * maskW + mx]
            if (val > 0) {
              binaryMask[y * w + x] = 1
              if (x < minX) minX = x
              if (y < minY) minY = y
              if (x > maxX) maxX = x
              if (y > maxY) maxY = y
              count++
            }
          }
        }

        if (count < 16 || minX >= maxX || minY >= maxY) {
          setProcessing({ status: 'idle', message: '', percentage: 0 })
          return false
        }

        // Crop extracted object
        const bw = maxX - minX + 1
        const bh = maxY - minY + 1
        const objCanvas = document.createElement('canvas')
        objCanvas.width = bw
        objCanvas.height = bh
        const objCtx = objCanvas.getContext('2d')!
        const objImg = objCtx.createImageData(bw, bh)

        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const oi = (minY + y) * w + (minX + x)
            if (binaryMask[oi] === 1) {
              const src = oi * 4
              const dst = (y * bw + x) * 4
              objImg.data[dst] = origData[src]
              objImg.data[dst + 1] = origData[src + 1]
              objImg.data[dst + 2] = origData[src + 2]
              objImg.data[dst + 3] = origData[src + 3] || 255
            }
          }
        }
        objCtx.putImageData(decontaminateEdges(objImg), 0, 0)

        // Inpaint the extracted object out of the background layer
        const dilated = dilateMask(binaryMask, w, h, 3)
        const inpainted = inpaintBackground(origData, dilated, w, h)
        bgCtx.putImageData(inpainted, 0, 0)
        const newBgUrl = bgCanvas.toDataURL('image/png')

        // Scale back to canvas coordinates
        const scaleX = bgLayer.width / w
        const scaleY = bgLayer.height / h

        pushHistory()
        updateLayer(bgLayer.id, { imageData: newBgUrl })
        cachedImageSrcRef.current = null // invalidate cached embedding for updated bg

        const samCount = layers.filter((l) => l.name.startsWith('SAM Object')).length + 1
        const newLayer: LayerItem = {
          id: `sam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `SAM Object ${samCount}`,
          type: 'image',
          visible: true,
          locked: false,
          opacity: 1,
          x: Math.round(bgLayer.x + minX * scaleX),
          y: Math.round(bgLayer.y + minY * scaleY),
          width: Math.max(4, Math.round(bw * scaleX)),
          height: Math.max(4, Math.round(bh * scaleY)),
          rotation: 0,
          imageData: objCanvas.toDataURL('image/png'),
        }

        addLayer(newLayer)
        setSelectedLayerId(newLayer.id)
        setProcessing({ status: 'idle', message: '', percentage: 0 })
        return true
      } catch (err) {
        console.error('SAM error:', err)
        setProcessing({
          status: 'error',
          message: `Error: ${err instanceof Error ? err.message : 'Magic select failed'}`,
          percentage: 0,
        })
        return false
      }
    },
    [layers, addLayer, updateLayer, setSelectedLayerId, setProcessing, pushHistory]
  )

  return { extractAtPoint }
}
