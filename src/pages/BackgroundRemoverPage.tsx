import { useState, useRef, useCallback } from 'react'
import {
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
} from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import DropZone from '../components/upload/DropZone'
import ProcessingOverlay from '../components/upload/ProcessingOverlay'
import { useBackgroundRemoval } from '../hooks/useBackgroundRemoval'
import { useEditorStore } from '../store/editorStore'

export default function BackgroundRemoverPage() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [sliderPos, setSliderPos] = useState(50)
  const [zoom, setZoom] = useState(1)
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDraggingSlider = useRef(false)

  const { removeBackground } = useBackgroundRemoval()
  const { processing, setProcessing } = useEditorStore()

  const handleFile = useCallback(
    async (file: File) => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(null)
      setOriginalUrl(URL.createObjectURL(file))
      setSliderPos(50)
      setZoom(1)

      const url = await removeBackground(file)
      if (url) setResultUrl(url)
    },
    [removeBackground, resultUrl]
  )

  const handleDownload = useCallback(() => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `magic-layer-removed-bg-${Date.now()}.png`
    a.click()
  }, [resultUrl])

  const handleReset = useCallback(() => {
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    setResultUrl(null)
    setOriginalUrl(null)
    setProcessing({ status: 'idle', message: '', percentage: 0 })
  }, [resultUrl, originalUrl, setProcessing])

  const onSliderMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingSlider.current || !sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    setSliderPos(pct)
  }, [])

  const onSliderMouseUp = useCallback(() => {
    isDraggingSlider.current = false
    document.removeEventListener('mousemove', onSliderMouseMove)
    document.removeEventListener('mouseup', onSliderMouseUp)
  }, [onSliderMouseMove])

  const onSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingSlider.current = true
    document.addEventListener('mousemove', onSliderMouseMove)
    document.addEventListener('mouseup', onSliderMouseUp)
  }

  const isProcessing = processing.status === 'processing' || processing.status === 'loading-model'

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-black">
              Background Remover
            </h1>
          </div>

          {!originalUrl ? (
            <DropZone onFile={handleFile} className="max-w-xl mx-auto" />
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                    className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-700"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                    className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-700"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-neutral-500">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-neutral-700 border border-neutral-200 hover:border-black"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                  {resultUrl && (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-black hover:bg-neutral-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PNG
                    </button>
                  )}
                </div>
              </div>

              <div
                className="relative overflow-auto flex items-center justify-center bg-neutral-100"
                style={{ minHeight: 400, maxHeight: 600 }}
              >
                {isProcessing && (
                  <div className="absolute inset-0 z-10">
                    <ProcessingOverlay progress={processing} />
                  </div>
                )}

                {originalUrl && (
                  <div
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.15s ease' }}
                  >
                    {resultUrl ? (
                      <div
                        ref={sliderRef}
                        className="relative select-none"
                        style={{ cursor: 'col-resize' }}
                      >
                        <div className="checkerboard rounded-lg overflow-hidden">
                          <img
                            src={resultUrl}
                            alt="Background removed"
                            className="block max-w-full max-h-[500px] object-contain"
                            draggable={false}
                          />
                        </div>

                        <div
                          className="absolute inset-0 overflow-hidden rounded-lg"
                          style={{ width: `${sliderPos}%` }}
                        >
                          <img
                            src={originalUrl}
                            alt="Original"
                            className="block max-w-none max-h-[500px] object-contain"
                            style={{ width: '100%', maxWidth: 'none' }}
                            draggable={false}
                          />
                        </div>

                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-black cursor-col-resize z-10 flex items-center justify-center"
                          style={{ left: `${sliderPos}%` }}
                          onMouseDown={onSliderMouseDown}
                        >
                          <div className="w-7 h-7 rounded-full bg-white border border-black flex items-center justify-center">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={originalUrl}
                        alt="Uploaded"
                        className="block max-w-full max-h-[500px] object-contain rounded-lg opacity-60"
                        draggable={false}
                      />
                    )}
                  </div>
                )}
              </div>

              {!isProcessing && (
                <div className="px-4 py-3 border-t border-neutral-200 flex justify-center">
                  <label
                    htmlFor="bg-remover-new-file"
                    className="text-xs text-neutral-600 hover:text-black cursor-pointer font-medium"
                  >
                    Upload another image
                    <input
                      id="bg-remover-new-file"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFile(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
