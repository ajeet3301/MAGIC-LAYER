import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, ArrowRight, CheckCircle2 } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import DropZone from '../components/upload/DropZone'
import ProcessingOverlay from '../components/upload/ProcessingOverlay'
import { useSegmentation } from '../hooks/useSegmentation'
import { useEditorStore } from '../store/editorStore'

export default function MagicLayersPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const navigate = useNavigate()

  const { segmentImage } = useSegmentation()
  const { processing, setProcessing, layers } = useEditorStore()

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

    const response = await fetch(previewUrl)
    const blob = await response.blob()
    const file = new File([blob], fileName || 'image.png', { type: blob.type })

    const success = await segmentImage(file)
    if (success) {
      setTimeout(() => {
        navigate('/editor')
      }, 800)
    }
  }, [previewUrl, fileName, segmentImage, navigate])

  const isProcessing =
    processing.status === 'processing' || processing.status === 'loading-model'
  const isDone = processing.status === 'done' && layers.length > 0

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-black">
              Magic Layers
            </h1>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            {!previewUrl ? (
              <div className="p-6">
                <DropZone onFile={handleFile} />
              </div>
            ) : (
              <div>
                <div className="relative bg-neutral-100 flex items-center justify-center min-h-64 max-h-96 overflow-hidden">
                  {isProcessing && (
                    <div className="absolute inset-0 z-10">
                      <ProcessingOverlay progress={processing} />
                    </div>
                  )}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className={`max-w-full max-h-96 object-contain ${isProcessing ? 'opacity-30' : 'opacity-100'} transition-opacity`}
                  />
                  {isDone && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90">
                      <CheckCircle2 className="w-8 h-8 text-black mb-2" />
                      <p className="font-medium text-black text-sm">{processing.message}</p>
                    </div>
                  )}
                </div>

                <div className="px-5 py-3.5 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-neutral-500 truncate max-w-xs">{fileName}</div>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="ml-new-file"
                      className="text-xs text-neutral-600 hover:text-black cursor-pointer font-medium"
                    >
                      Change
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
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-black hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <Layers className="w-4 h-4 animate-pulse" />
                          Processing…
                        </>
                      ) : isDone ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Opening…
                        </>
                      ) : (
                        <>
                          Separate Layers
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
