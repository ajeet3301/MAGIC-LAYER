import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Undo2,
  Redo2,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  ScanText,
  Archive,
  Home,
  Trash2,
  Copy,
  Plus,
} from 'lucide-react'
import JSZip from 'jszip'
import CanvasEditor from '../components/editor/CanvasEditor'
import LayersPanel from '../components/editor/LayersPanel'
import PropertiesPanel from '../components/editor/PropertiesPanel'
import ProcessingOverlay from '../components/upload/ProcessingOverlay'
import { useEditorStore } from '../store/editorStore'
import { useOCR } from '../hooks/useOCR'

type ExportFormat = 'png' | 'jpg' | 'zip'

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  disabled = false,
  active = false,
  danger = false,
}: {
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active ? 'bg-purple-100 text-purple-700' : ''}
        ${danger ? 'hover:bg-red-50 hover:text-red-600 text-zinc-600' : ''}
        ${!active && !danger ? 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-800' : ''}
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export default function EditorPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [showExportMenu, setShowExportMenu] = useState(false)

  const {
    layers,
    selectedLayerId,
    canvasWidth,
    canvasHeight,
    originalImageUrl,
    undo,
    redo,
    canUndo,
    canRedo,
    removeLayer,
    duplicateLayer,
    processing,
    setProcessing,
    reset,
  } = useEditorStore()

  const { extractText } = useOCR()

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && selectedLayerId) {
          e.preventDefault()
          removeLayer(selectedLayerId)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedLayerId) {
        e.preventDefault()
        duplicateLayer(selectedLayerId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, removeLayer, duplicateLayer, selectedLayerId])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setShowExportMenu(false)

      if (format === 'zip') {
        setProcessing({ status: 'processing', message: 'Creating ZIP…', percentage: 10 })
        const zip = new JSZip()
        const folder = zip.folder('magic-layer-export')!

        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i]
          if (layer.type === 'image' && layer.imageData) {
            const base64 = layer.imageData.split(',')[1]
            folder.file(`${i + 1}_${layer.name.replace(/[^a-z0-9]/gi, '_')}.png`, base64, {
              base64: true,
            })
          }
          setProcessing({
            status: 'processing',
            message: `Packing layer ${i + 1}/${layers.length}…`,
            percentage: Math.round(10 + (i / layers.length) * 80),
          })
          await new Promise((r) => setTimeout(r, 10))
        }

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `magic-layer-export-${Date.now()}.zip`
        a.click()
        URL.revokeObjectURL(url)

        setProcessing({ status: 'done', message: 'ZIP downloaded!', percentage: 100 })
        setTimeout(() => setProcessing({ status: 'idle', message: '', percentage: 0 }), 2000)
        return
      }

      // PNG / JPG: use Konva stage export
      if (!stageRef.current) return
      setProcessing({ status: 'processing', message: 'Exporting image…', percentage: 50 })

      const dataUrl = stageRef.current.toDataURL({
        mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
        pixelRatio: 2,
        quality: 1,
      })

      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `magic-layer-${Date.now()}.${format}`
      a.click()

      setProcessing({ status: 'done', message: 'Image downloaded!', percentage: 100 })
      setTimeout(() => setProcessing({ status: 'idle', message: '', percentage: 0 }), 2000)
    },
    [layers, setProcessing, stageRef]
  )

  const handleOCR = useCallback(async () => {
    const imageUrl = originalImageUrl ?? layers.find((l) => l.imageData)?.imageData
    if (!imageUrl) return
    await extractText(imageUrl, canvasWidth, canvasHeight)
  }, [originalImageUrl, layers, extractText, canvasWidth, canvasHeight])

  const isProcessing =
    processing.status === 'processing' || processing.status === 'loading-model'

  if (layers.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <Layers className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-700 mb-2">No image loaded</h2>
          <p className="text-zinc-500 mb-6">Go to Magic Layers to upload and process an image.</p>
          <button
            onClick={() => navigate('/magic-layers')}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-sky-500"
          >
            Go to Magic Layers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-100 overflow-hidden">
      {/* Top toolbar */}
      <header className="flex items-center gap-2 px-4 py-2 bg-white border-b border-zinc-200 shadow-sm z-10 shrink-0">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 mr-3 group"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-sky-500 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="hidden sm:block font-bold text-sm text-zinc-700 group-hover:text-purple-700 transition-colors">
            Magic Layer
          </span>
        </button>

        <div className="h-5 w-px bg-zinc-200" />

        {/* History */}
        <ToolbarButton icon={Undo2} label="Undo" onClick={undo} disabled={!canUndo} />
        <ToolbarButton icon={Redo2} label="Redo" onClick={redo} disabled={!canRedo} />

        <div className="h-5 w-px bg-zinc-200" />

        {/* Selection actions */}
        {selectedLayerId && (
          <>
            <ToolbarButton
              icon={Copy}
              label="Duplicate"
              onClick={() => duplicateLayer(selectedLayerId)}
            />
            <ToolbarButton
              icon={Trash2}
              label="Delete"
              onClick={() => removeLayer(selectedLayerId)}
              danger
            />
            <div className="h-5 w-px bg-zinc-200" />
          </>
        )}

        {/* OCR */}
        <ToolbarButton
          icon={ScanText}
          label="Extract Text"
          onClick={handleOCR}
          disabled={isProcessing}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Canvas info */}
        <span className="text-xs text-zinc-400 hidden sm:block">
          {canvasWidth} × {canvasHeight}px
        </span>

        <div className="h-5 w-px bg-zinc-200" />

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-sky-500 hover:opacity-90 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden min-w-40 animate-fade-in">
              {(['png', 'jpg', 'zip'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-zinc-700 hover:bg-purple-50 hover:text-purple-700 transition-colors text-left"
                >
                  {fmt === 'zip' ? <Archive className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                  {fmt === 'png' && 'Download PNG'}
                  {fmt === 'jpg' && 'Download JPG'}
                  {fmt === 'zip' && 'Download All (ZIP)'}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main editor layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Layers Panel */}
        <aside className="w-56 shrink-0 overflow-y-auto">
          <LayersPanel />
        </aside>

        {/* Center — Canvas */}
        <main
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          onClick={() => setShowExportMenu(false)}
        >
          {isProcessing && (
            <div className="absolute inset-0 z-10">
              <ProcessingOverlay progress={processing} />
            </div>
          )}
          <CanvasEditor
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />

          {/* Pass stage ref from child — workaround via context or callback ref */}
          {/* Stage ref is handled internally in CanvasEditor, we re-export via window for quick access */}
        </main>

        {/* Right — Properties Panel */}
        <aside className="w-56 shrink-0 overflow-y-auto">
          <PropertiesPanel />
        </aside>
      </div>

      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  )
}
