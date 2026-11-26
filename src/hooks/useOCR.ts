import { useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import type { LayerItem } from '../types'

export function useOCR() {
  const { addLayer, setProcessing } = useEditorStore()

  const extractText = useCallback(
    async (imageUrl: string, canvasWidth: number, canvasHeight: number): Promise<boolean> => {
      try {
        setProcessing({
          status: 'loading-model',
          message: 'Magic starting…',
          percentage: 5,
        })

        // Determine source image dimensions for accurate coordinate mapping
        const imgDims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ w: img.naturalWidth || canvasWidth, h: img.naturalHeight || canvasHeight })
          img.onerror = () => resolve({ w: canvasWidth, h: canvasHeight })
          img.src = imageUrl
        })

        const { createWorker } = await import('tesseract.js')

        const worker = await createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setProcessing({
                status: 'processing',
                message: 'Magic doing…',
                percentage: Math.round(10 + m.progress * 85),
              })
            } else if (m.status.includes('loading')) {
              setProcessing({
                status: 'loading-model',
                message: 'Magic start…',
                percentage: Math.round(m.progress * 10),
              })
            }
          },
        })

        const { data } = await worker.recognize(imageUrl, {}, { blocks: true })
        await worker.terminate()

        const lines = (data.blocks ?? []).flatMap((b) =>
          b.paragraphs.flatMap((p) => p.lines)
        )

        if (lines.length === 0) {
          setProcessing({
            status: 'done',
            message: 'No text detected in image.',
            percentage: 100,
          })
          return false
        }

        const scaleX = canvasWidth / imgDims.w
        const scaleY = canvasHeight / imgDims.h

        let addedCount = 0
        for (const line of lines) {
          if (!line.text.trim() || line.confidence < 30) continue

          const { x0, y0, x1, y1 } = line.bbox

          const textLayer: LayerItem = {
            id: `text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: `Text: "${line.text.trim().slice(0, 20)}${line.text.trim().length > 20 ? '…' : ''}"`,
            type: 'text',
            visible: true,
            locked: false,
            opacity: 1,
            x: Math.round(x0 * scaleX),
            y: Math.round(y0 * scaleY),
            width: Math.max(20, Math.round((x1 - x0) * scaleX)),
            height: Math.max(16, Math.round((y1 - y0) * scaleY)),
            rotation: 0,
            text: line.text.trim(),
            fontSize: Math.max(12, Math.round((y1 - y0) * scaleY * 0.7)),
            fontFamily: 'Inter, sans-serif',
            fontWeight: '400',
            fill: '#000000',
            textAlign: 'left',
            letterSpacing: 0,
          }
          addLayer(textLayer)
          addedCount++
        }

        setProcessing({
          status: 'done',
          message: `Extracted ${addedCount} text layer${addedCount !== 1 ? 's' : ''}!`,
          percentage: 100,
        })

        return addedCount > 0
      } catch (err: unknown) {
        console.error('OCR error:', err)
        setProcessing({
          status: 'error',
          message: `OCR failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          percentage: 0,
        })
        return false
      }
    },
    [addLayer, setProcessing]
  )

  return { extractText }
}
