import { useState, useRef, useCallback } from 'react'
import {
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  Eraser,
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
  const [showInfo, setShowInfo] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDraggingSlider = useRef(false)

  const { removeBackground } = useBackgroundRemoval()
  const { processing, setProcessing } = useEditorStore()

  const handleFile = useCallback(
    async (file: File) => {
      // Clear old URLs
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

  // Slider mouse events
  const onSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingSlider.current = true
    document.addEventListener('mousemove', onSliderMouseMove)
    document.addEventListener('mouseup', onSliderMouseUp)
  }

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

  const isProcessing = processing.status === 'processing' || processing.status === 'loading-model'
  const isDone = processing.status === 'done' && resultUrl

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium mb-4">
              <Eraser className="w-3.5 h-3.5" />
              AI Background Remover
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-zinc-900">
              Remove Image Backgrounds
            </h1>
            <p className="mt-3 text-zinc-500 max-w-lg mx-auto">
              Upload any image and AI will instantly remove the background. Download a crisp, transparent PNG.
            </p>
          </div>

          {/* Info banner */}
          {!originalUrl && (
            <div
              className="mb-6 flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-700 cursor-pointer"
              onClick={() => setShowInfo(!showInfo)}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">AI Model Info</p>
                {showInfo && (
                  <p className="mt-1 text-sky-600">
                    Magic Layer uses <strong>ISNet</strong> (quantized, ~44MB) running locally in your browser via WebAssembly.
                    The model is downloaded once and cached. Your images are <strong>never uploaded</strong> to any server.
                  </p>
                )}
              </div>
            </div>
          )}

          {!originalUrl ? (
            /* Upload zone */
            <DropZone onFile={handleFile} className="max-w-2xl mx-auto" />
          ) : (
            /* Processing / Result area */
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-zinc-400">{Math.round(zoom * 100)}%</span>
                  {resultUrl && (
                    <div className="flex items-center gap-1.5 ml-2 text-xs text-zinc-400">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Drag slider to compare
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isDone && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Background removed
                    </div>
                  )}
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                  {resultUrl && (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-sky-500 hover:opacity-90 shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PNG
                    </button>
                  )}
                </div>
              </div>

              {/* Canvas area */}
              <div
                className="relative overflow-auto flex items-center justify-center"
                style={{ minHeight: 400, maxHeight: 600, background: '#f4f4f5' }}
              >
                {isProcessing && (
                  <div className="absolute inset-0 z-10">
                    <ProcessingOverlay progress={processing} />
                  </div>
                )}

                {originalUrl && (
                  <div
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s ease' }}
                  >
                    {resultUrl ? (
                      /* Before/After slider */
                      <div
                        ref={sliderRef}
                        className="relative select-none"
                        style={{ cursor: 'col-resize' }}
                      >
                        {/* Result (after) layer - transparent PNG with checkerboard */}
                        <div className="checkerboard rounded-lg overflow-hidden">
                          <img
                            src={resultUrl}
                            alt="Background removed"
                            className="block max-w-full max-h-[500px] object-contain"
                            draggable={false}
                          />
                        </div>

                        {/* Original (before) overlay — clipped to left side */}
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

                        {/* Slider handle */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-col-resize z-10 flex items-center justify-center"
                          style={{ left: `${sliderPos}%` }}
                          onMouseDown={onSliderMouseDown}
                        >
                          <div className="w-8 h-8 rounded-full bg-white shadow-lg border border-zinc-200 flex items-center justify-center">
                            <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
                          </div>
                        </div>

                        {/* Labels */}
                        <div className="absolute top-2 left-2 text-xs font-medium text-white bg-black/50 backdrop-blur-sm rounded px-2 py-0.5">
                          Original
                        </div>
                        <div className="absolute top-2 right-2 text-xs font-medium text-white bg-black/50 backdrop-blur-sm rounded px-2 py-0.5">
                          Transparent
                        </div>
                      </div>
                    ) : (
                      /* Just original while processing */
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

              {/* Upload another */}
              {!isProcessing && (
                <div className="px-4 py-3 border-t border-zinc-100 flex justify-center">
                  <label
                    htmlFor="bg-remover-new-file"
                    className="text-sm text-zinc-500 hover:text-purple-600 cursor-pointer transition-colors font-medium"
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
