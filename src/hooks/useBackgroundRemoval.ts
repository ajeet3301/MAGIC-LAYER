import { useCallback, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'

export function useBackgroundRemoval() {
  const { setProcessing } = useEditorStore()
  const abortRef = useRef(false)

  const removeBackground = useCallback(
    async (file: File): Promise<string | null> => {
      abortRef.current = false

      try {
        setProcessing({
          status: 'loading-model',
          message: 'Loading AI model… (downloads once, then cached)',
          percentage: 0,
        })

        // Dynamic import to avoid bundling issues
        const { removeBackground: removeBg } = await import('@imgly/background-removal')

        if (abortRef.current) return null

        const result = await removeBg(file, {
          model: 'isnet_quint8',
          progress: (key: string, current: number, total: number) => {
            if (abortRef.current) return
            const pct = total > 0 ? Math.round((current / total) * 100) : 0

            if (key.includes('fetch') || key.includes('download')) {
              setProcessing({
                status: 'loading-model',
                message: `Downloading AI model: ${key.split(':').pop()?.trim() ?? ''}`,
                percentage: pct,
              })
            } else {
              setProcessing({
                status: 'processing',
                message: 'Removing background…',
                percentage: Math.min(50 + Math.round(pct / 2), 99),
              })
            }
          },
          output: {
            format: 'image/png',
          },
        })

        if (abortRef.current) return null

        setProcessing({
          status: 'done',
          message: 'Background removed successfully!',
          percentage: 100,
        })

        const url = URL.createObjectURL(result as Blob)
        return url
      } catch (err: unknown) {
        console.error('Background removal error:', err)
        setProcessing({
          status: 'error',
          message: `Error: ${err instanceof Error ? err.message : 'Background removal failed'}`,
          percentage: 0,
        })
        return null
      }
    },
    [setProcessing]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
    setProcessing({ status: 'idle', message: '', percentage: 0 })
  }, [setProcessing])

  return { removeBackground, cancel }
}
