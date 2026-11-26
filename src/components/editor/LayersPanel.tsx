import { useCallback } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  GripVertical,
  Image,
  Type,
  Square,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { LayerItem } from '../../types'

function LayerTypeIcon({ type }: { type: LayerItem['type'] }) {
  switch (type) {
    case 'text': return <Type className="w-3 h-3 text-neutral-700" />
    case 'shape': return <Square className="w-3 h-3 text-neutral-700" />
    default: return <Image className="w-3 h-3 text-neutral-700" />
  }
}

interface LayerRowProps {
  layer: LayerItem
  index: number
  isSelected: boolean
  totalLayers: number
}

function LayerRow({ layer, index, isSelected, totalLayers }: LayerRowProps) {
  const {
    updateLayer,
    removeLayer,
    duplicateLayer,
    reorderLayers,
    setSelectedLayerId,
  } = useEditorStore()

  const handleVisibility = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateLayer(layer.id, { visible: !layer.visible })
    },
    [layer.id, layer.visible, updateLayer]
  )

  const handleLock = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateLayer(layer.id, { locked: !layer.locked })
    },
    [layer.id, layer.locked, updateLayer]
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      removeLayer(layer.id)
    },
    [layer.id, removeLayer]
  )

  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      duplicateLayer(layer.id)
    },
    [layer.id, duplicateLayer]
  )

  const moveUp = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (index < totalLayers - 1) reorderLayers(index, index + 1)
  }

  const moveDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (index > 0) reorderLayers(index, index - 1)
  }

  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-2 cursor-pointer select-none
        border-b border-neutral-100 transition-colors
        ${isSelected ? 'bg-neutral-100 border-l-2 border-l-black' : 'hover:bg-neutral-50'}
      `}
      onClick={() => setSelectedLayerId(isSelected ? null : layer.id)}
    >
      {/* Drag handle */}
      <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 cursor-grab" />

      {/* Thumbnail */}
      <div className="w-8 h-8 rounded border border-neutral-200 overflow-hidden shrink-0 bg-neutral-100 flex items-center justify-center">
        {layer.type === 'image' && layer.imageData ? (
          <img src={layer.imageData} alt="" className="w-full h-full object-cover" />
        ) : layer.type === 'text' ? (
          <Type className="w-4 h-4 text-neutral-500" />
        ) : (
          <Square className="w-4 h-4 text-neutral-500" />
        )}
      </div>

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <LayerTypeIcon type={layer.type} />
          <span className={`text-xs font-medium truncate ${isSelected ? 'text-black' : 'text-neutral-700'}`}>
            {layer.name}
          </span>
        </div>
        {layer.type === 'text' && (
          <p className="text-xs text-neutral-400 truncate">{layer.text?.slice(0, 20)}</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={moveUp} className="p-1 rounded hover:bg-neutral-200" title="Move up">
          <ChevronUp className="w-3 h-3 text-neutral-600" />
        </button>
        <button onClick={moveDown} className="p-1 rounded hover:bg-neutral-200" title="Move down">
          <ChevronDown className="w-3 h-3 text-neutral-600" />
        </button>
        <button onClick={handleDuplicate} className="p-1 rounded hover:bg-neutral-200" title="Duplicate">
          <Copy className="w-3 h-3 text-neutral-600" />
        </button>
        <button onClick={handleDelete} className="p-1 rounded hover:bg-neutral-200" title="Delete">
          <Trash2 className="w-3 h-3 text-neutral-600" />
        </button>
      </div>

      {/* Visibility + Lock */}
      <div className="flex items-center gap-0.5 ml-1">
        <button
          onClick={handleVisibility}
          className={`p-1 rounded transition-colors ${layer.visible ? 'text-neutral-500 hover:text-black' : 'text-neutral-300 hover:text-neutral-500'}`}
          title={layer.visible ? 'Hide layer' : 'Show layer'}
        >
          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleLock}
          className={`p-1 rounded transition-colors ${layer.locked ? 'text-black' : 'text-neutral-300 hover:text-neutral-500'}`}
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        >
          {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

export default function LayersPanel() {
  const { layers, selectedLayerId, addLayer, canvasWidth, canvasHeight } = useEditorStore()

  const handleAddText = () => {
    addLayer({
      id: `text-${Date.now()}`,
      name: 'New Text',
      type: 'text',
      visible: true,
      locked: false,
      opacity: 1,
      x: canvasWidth / 2 - 100,
      y: canvasHeight / 2 - 20,
      width: 200,
      height: 40,
      rotation: 0,
      text: 'Double-click to edit',
      fontSize: 24,
      fontFamily: 'Inter, sans-serif',
      fontWeight: '600',
      fill: '#18181b',
      textAlign: 'left',
      letterSpacing: 0,
    })
  }

  // Layers displayed in reverse order (top layer first visually)
  const reversedLayers = [...layers].reverse()

  return (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-100">
        <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
          Layers ({layers.length})
        </h2>
        <button
          onClick={handleAddText}
          className="text-xs text-black font-medium hover:underline"
        >
          + Text
        </button>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto">
        {reversedLayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
              <Image className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-xs text-zinc-400">No layers yet.</p>
            <p className="text-xs text-zinc-400">Upload an image to get started.</p>
          </div>
        ) : (
          reversedLayers.map((layer, reversedIndex) => {
            const originalIndex = layers.length - 1 - reversedIndex
            return (
              <LayerRow
                key={layer.id}
                layer={layer}
                index={originalIndex}
                isSelected={layer.id === selectedLayerId}
                totalLayers={layers.length}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
