import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Sparkles, ArrowRight, Info, CheckCircle2 } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import DropZone from '../components/upload/DropZone'
import ProcessingOverlay from '../components/upload/ProcessingOverlay'
import { useSegmentation } from '../hooks/useSegmentation'
import { useEditorStore } from '../store/editorStore'

const capabilities = [
  'Analyzes color regions and visual structure',
  'Separates foreground from background',
  'Detects distinct visual elements',
  'Groups similar color areas into layers',
  'Preserves original pixel quality',
]

export default function MagicLayersPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const navigate = useNavigate()

  const { segmentImage } = useSegmentation()
  const { processing, setProcessing, layers } = useEditorStore()

  // Pick up image uploaded from homepage
  useEffect(() => {
    const pendingUrl = sessionStorage.getItem('pendingImageUrl')
    const pendingName = sessionStorage.getItem('pendingImageName')
    if (pendingUrl && pendingName) {
      sessionStorage.removeItem('pendingImageUrl')
      sessionStorage.removeItem('pendingImageName')
      setPreviewUrl(pendingUrl)
      setFileName(pendingName)
    }
  }, [])

  const handleFile = useCallback((file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setFileName(file.name)
    setProcessing({ status: 'idle', message: '', percentage: 0 })
  }, [previewUrl, setProcessing])

  const handleProcessImage = useCallback(async () => {
    if (!previewUrl) return

    // We need to convert the URL back to a File/Blob for the segmentation hook
    const response = await fetch(previewUrl)
    const blob = await response.blob()
    const file = new File([blob], fileName || 'image.png', { type: blob.type })

    const success = await segmentImage(file)
    if (success) {
      // Brief delay to show success message then navigate
      setTimeout(() => {
        navigate('/editor')
      }, 1200)
    }
  }, [previewUrl, fileName, segmentImage, navigate])

  const isProcessing =
    processing.status === 'processing' || processing.status === 'loading-model'
  const isDone = processing.status === 'done' && layers.length > 0

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Magic Layers — Powered by On-Device AI
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-zinc-900">
              Transform Any Image Into{' '}
              <span className="gradient-text">Independent Layers</span>
            </h1>
            <p className="mt-3 text-zinc-500 max-w-xl mx-auto">
              Upload a flat image. AI separates it into editable elements. Edit each part independently.
            </p>
          </div>

          {/* Info panel about how it works */}
          <div className="mb-6 bg-white border border-zinc-100 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-800 text-sm mb-2">How Magic Layers works</h3>
                <ul className="space-y-1">
                  {capabilities.map((cap) => (
                    <li key={cap} className="flex items-center gap-2 text-sm text-zinc-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                      {cap}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-zinc-400 bg-zinc-50 rounded-lg p-2">
                  <strong>Note:</strong> Magic Layers uses color-region analysis to separate visual elements.
                  Results work best on images with clearly distinct areas. For complex scenes,
                  you can manually adjust layers in the editor.
                </p>
              </div>
            </div>
          </div>

          {/* Upload / Preview area */}
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            {!previewUrl ? (
              <div className="p-8">
                <DropZone onFile={handleFile} />
              </div>
            ) : (
              <div>
                {/* Preview */}
                <div className="relative bg-zinc-100 flex items-center justify-center min-h-64 max-h-96 overflow-hidden">
                  {isProcessing && (
                    <div className="absolute inset-0 z-10">
                      <ProcessingOverlay progress={processing} />
                    </div>
                  )}
                  <img
                    src={previewUrl}
                    alt="To segment"
                    className={`max-w-full max-h-96 object-contain ${isProcessing ? 'opacity-30' : 'opacity-100'} transition-opacity`}
                  />
                  {isDone && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm animate-fade-in">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                      <p className="font-bold text-zinc-800 text-lg">{processing.message}</p>
                      <p className="text-sm text-zinc-500 mb-5">Opening editor…</p>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="px-6 py-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-zinc-500 truncate max-w-xs">{fileName}</div>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="ml-new-file"
                      className="text-sm text-zinc-500 hover:text-purple-600 cursor-pointer transition-colors font-medium"
                    >
                      Change image
                      <input
                        id="ml-new-file"
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
                    <button
                      onClick={handleProcessImage}
                      disabled={isProcessing || isDone}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-sky-500 hover:opacity-90 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <Layers className="w-4 h-4 animate-pulse" />
                          Processing…
                        </>
                      ) : isDone ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Opening editor…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Apply Magic Layers
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-zinc-100 p-5">
              <h3 className="font-semibold text-zinc-800 text-sm mb-1">Best results with:</h3>
              <ul className="text-sm text-zinc-500 space-y-1 mt-2">
                <li>• Product photos on plain backgrounds</li>
                <li>• Posters and graphic designs</li>
                <li>• Photos with distinct foreground objects</li>
                <li>• Illustrations with clear color areas</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-zinc-100 p-5">
              <h3 className="font-semibold text-zinc-800 text-sm mb-1">In the editor you can:</h3>
              <ul className="text-sm text-zinc-500 space-y-1 mt-2">
                <li>• Move, resize, rotate each layer</li>
                <li>• Toggle visibility and lock layers</li>
                <li>• Extract text with OCR</li>
                <li>• Export as PNG, JPG, or ZIP</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
