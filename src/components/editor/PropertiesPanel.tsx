import { useCallback } from 'react'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Bold,
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'

function NumberInput({
  label,
  value,
  onChange,
  unit = '',
  min,
  max,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5">
        <input
          type="number"
          value={Math.round(value * 100) / 100}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-full bg-transparent text-xs text-zinc-700 font-medium outline-none [appearance:textfield]"
        />
        {unit && <span className="text-xs text-zinc-400 shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

export default function PropertiesPanel() {
  const { layers, selectedLayerId, updateLayer, canvasWidth, canvasHeight } = useEditorStore()

  const selectedLayer = layers.find((l) => l.id === selectedLayerId)

  const update = useCallback(
    (updates: Parameters<typeof updateLayer>[1]) => {
      if (selectedLayerId) updateLayer(selectedLayerId, updates)
    },
    [selectedLayerId, updateLayer]
  )

  if (!selectedLayer) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-zinc-200">
        <div className="px-3 py-3 border-b border-zinc-100">
          <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Properties</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-xs text-zinc-400">Select a layer to edit its properties.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200 overflow-y-auto">
      {/* Panel header */}
      <div className="px-3 py-3 border-b border-zinc-100">
        <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Properties</h2>
        <p className="text-xs text-zinc-400 truncate mt-0.5">{selectedLayer.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Transform section */}
        <div className="px-3 py-4 border-b border-zinc-100 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Transform</h3>

          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={selectedLayer.x} onChange={(v) => update({ x: v })} />
            <NumberInput label="Y" value={selectedLayer.y} onChange={(v) => update({ y: v })} />
            <NumberInput label="W" value={selectedLayer.width} min={1} onChange={(v) => update({ width: Math.max(1, v) })} unit="px" />
            <NumberInput label="H" value={selectedLayer.height} min={1} onChange={(v) => update({ height: Math.max(1, v) })} unit="px" />
          </div>

          <NumberInput
            label="Rotation"
            value={selectedLayer.rotation}
            onChange={(v) => update({ rotation: v })}
            min={-360}
            max={360}
            unit="°"
          />

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-neutral-500 font-medium">Opacity</label>
              <span className="text-xs text-neutral-700 font-medium">{Math.round(selectedLayer.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(selectedLayer.opacity * 100)}
              onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-black cursor-pointer"
            />
          </div>

          {/* Align to Canvas */}
          <div className="pt-1">
            <label className="text-xs text-neutral-500 font-medium block mb-1.5">Align to Canvas</label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => update({ x: 0 })}
                className="px-2 py-1 text-xs border border-neutral-200 rounded hover:border-black"
              >
                Left
              </button>
              <button
                onClick={() => update({ x: Math.round((canvasWidth - selectedLayer.width) / 2) })}
                className="px-2 py-1 text-xs border border-neutral-200 rounded hover:border-black"
              >
                Center
              </button>
              <button
                onClick={() => update({ x: Math.round(canvasWidth - selectedLayer.width) })}
                className="px-2 py-1 text-xs border border-neutral-200 rounded hover:border-black"
              >
                Right
              </button>
              <button
                onClick={() => update({ y: 0 })}
                className="px-2 py-1 text-xs border border-neutral-200 rounded hover:border-black"
              >
                Top
              </button>
              <button
                onClick={() => update({ y: Math.round((canvasHeight - selectedLayer.height) / 2) })}
                className="px-2 py-1 text-xs border border-neutral-200 rounded hover:border-black"
              >
                Middle
              </button>
              <button
                onClick={() => update({ y: Math.round(canvasHeight - selectedLayer.height) })}
                className="px-2 py-1 text-xs border border-neutral-200 rounded hover:border-black"
              >
                Bottom
              </button>
            </div>
          </div>
        </div>

        {/* State section */}
        <div className="px-3 py-4 border-b border-zinc-100 space-y-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">State</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => update({ visible: !selectedLayer.visible })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-1 justify-center ${
                selectedLayer.visible
                  ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                  : 'border-zinc-200 bg-zinc-100 text-zinc-400'
              }`}
            >
              {selectedLayer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {selectedLayer.visible ? 'Visible' : 'Hidden'}
            </button>
            <button
              onClick={() => update({ locked: !selectedLayer.locked })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-1 justify-center ${
                selectedLayer.locked
                  ? 'border-black bg-black text-white'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {selectedLayer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {selectedLayer.locked ? 'Locked' : 'Unlocked'}
            </button>
          </div>
        </div>

        {/* Text properties */}
        {selectedLayer.type === 'text' && (
          <div className="px-3 py-4 border-b border-zinc-100 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Text</h3>

            {/* Text content */}
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Content</label>
              <textarea
                value={selectedLayer.text ?? ''}
                onChange={(e) => update({ text: e.target.value })}
                rows={3}
                className="w-full text-xs text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:border-black resize-none"
              />
            </div>

            <NumberInput
              label="Font Size"
              value={selectedLayer.fontSize ?? 16}
              min={6}
              max={300}
              onChange={(v) => update({ fontSize: v })}
              unit="px"
            />

            {/* Font weight */}
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Style</label>
              <button
                onClick={() => update({ fontWeight: selectedLayer.fontWeight === 'bold' ? '400' : 'bold' })}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  selectedLayer.fontWeight === 'bold'
                    ? 'border-black bg-black text-white'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Text color */}
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedLayer.fill ?? '#000000'}
                  onChange={(e) => update({ fill: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-zinc-200 cursor-pointer p-0.5"
                />
                <span className="text-xs text-zinc-500 font-mono">{selectedLayer.fill ?? '#000000'}</span>
              </div>
            </div>

            {/* Alignment */}
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Alignment</label>
              <div className="flex items-center gap-1">
                {(['left', 'center', 'right'] as const).map((align) => {
                  const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
                  return (
                    <button
                      key={align}
                      onClick={() => update({ textAlign: align })}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        selectedLayer.textAlign === align
                          ? 'border-black bg-black text-white'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  )
                })}
              </div>
            </div>

            <NumberInput
              label="Letter Spacing"
              value={selectedLayer.letterSpacing ?? 0}
              min={-10}
              max={50}
              step={0.5}
              onChange={(v) => update({ letterSpacing: v })}
              unit="px"
            />
          </div>
        )}

        {/* Shape properties */}
        {selectedLayer.type === 'shape' && (
          <div className="px-3 py-4 border-b border-neutral-100 space-y-3">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Shape</h3>
            <div className="flex items-center gap-1">
              {(['rect', 'circle'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => update({ shapeType: st })}
                  className={`flex-1 py-1.5 text-xs rounded-md border capitalize ${
                    (selectedLayer.shapeType ?? 'rect') === st
                      ? 'bg-black text-white border-black'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-black'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-medium block mb-1">Fill Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedLayer.shapeFill ?? '#000000'}
                  onChange={(e) => update({ shapeFill: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                />
                <span className="text-xs text-neutral-500 font-mono">{selectedLayer.shapeFill ?? '#000000'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Reset transform */}
        <div className="px-3 py-4">
          <button
            onClick={() => update({ x: 0, y: 0, rotation: 0, opacity: 1 })}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset transform
          </button>
        </div>
      </div>
    </div>
  )
}
