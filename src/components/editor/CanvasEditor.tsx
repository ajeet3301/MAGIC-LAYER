import { useRef, useEffect, useCallback, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Circle, Transformer } from 'react-konva'
import useImage from 'use-image'
import { useEditorStore } from '../../store/editorStore'
import type { LayerItem } from '../../types'

function ImageElement({
  layer,
  onSelect,
}: {
  layer: LayerItem
  onSelect: () => void
}) {
  const [image] = useImage(layer.imageData ?? '', 'anonymous')
  const shapeRef = useRef<any>(null)
  const { updateLayer } = useEditorStore()

  return (
    <KonvaImage
      ref={shapeRef}
      id={layer.id}
      image={image}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })
      }}
      onTransformEnd={() => {
        const node = shapeRef.current
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        updateLayer(layer.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(1, node.width() * scaleX),
          height: Math.max(1, node.height() * scaleY),
        })
      }}
    />
  )
}

function TextElement({
  layer,
  isEditing,
  onSelect,
  onStartEdit,
}: {
  layer: LayerItem
  isEditing: boolean
  onSelect: () => void
  onStartEdit: () => void
}) {
  const shapeRef = useRef<any>(null)
  const { updateLayer } = useEditorStore()

  return (
    <KonvaText
      ref={shapeRef}
      id={layer.id}
      text={layer.text ?? ''}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      fontSize={layer.fontSize ?? 16}
      fontFamily={layer.fontFamily ?? 'Inter, sans-serif'}
      fontStyle={layer.fontWeight === 'bold' ? 'bold' : 'normal'}
      fill={layer.fill ?? '#000000'}
      align={layer.textAlign ?? 'left'}
      letterSpacing={layer.letterSpacing ?? 0}
      rotation={layer.rotation}
      opacity={isEditing ? 0 : layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked && !isEditing}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={() => {
        if (!layer.locked) onStartEdit()
      }}
      onDblTap={() => {
        if (!layer.locked) onStartEdit()
      }}
      onDragEnd={(e) => {
        updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })
      }}
      onTransformEnd={() => {
        const node = shapeRef.current
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        updateLayer(layer.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(20, node.width() * scaleX),
          fontSize: Math.max(6, (layer.fontSize ?? 16) * scaleY),
        })
      }}
    />
  )
}

function ShapeElement({
  layer,
  onSelect,
}: {
  layer: LayerItem
  onSelect: () => void
}) {
  const shapeRef = useRef<any>(null)
  const { updateLayer } = useEditorStore()

  const commonProps = {
    ref: shapeRef,
    id: layer.id,
    x: layer.shapeType === 'circle' ? layer.x + layer.width / 2 : layer.x,
    y: layer.shapeType === 'circle' ? layer.y + layer.height / 2 : layer.y,
    fill: layer.shapeFill ?? '#000000',
    stroke: layer.shapeStroke ?? undefined,
    strokeWidth: layer.shapeStroke ? 2 : 0,
    rotation: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    draggable: !layer.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: any) => {
      if (layer.shapeType === 'circle') {
        updateLayer(layer.id, {
          x: e.target.x() - layer.width / 2,
          y: e.target.y() - layer.height / 2,
        })
      } else {
        updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })
      }
    },
    onTransformEnd: () => {
      const node = shapeRef.current
      if (!node) return
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)
      if (layer.shapeType === 'circle') {
        const newW = Math.max(4, node.radiusX() * 2 * scaleX)
        const newH = Math.max(4, node.radiusY() * 2 * scaleY)
        updateLayer(layer.id, {
          x: node.x() - newW / 2,
          y: node.y() - newH / 2,
          rotation: node.rotation(),
          width: newW,
          height: newH,
        })
      } else {
        updateLayer(layer.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(4, node.width() * scaleX),
          height: Math.max(4, node.height() * scaleY),
        })
      }
    },
  }

  if (layer.shapeType === 'circle') {
    return (
      <Circle
        {...commonProps}
        radius={Math.max(2, Math.min(layer.width, layer.height) / 2)}
      />
    )
  }

  return (
    <Rect
      {...commonProps}
      width={layer.width}
      height={layer.height}
      cornerRadius={4}
    />
  )
}

interface CanvasEditorProps {
  containerWidth: number
  containerHeight: number
  stageRef?: React.RefObject<any>
  zoomMultiplier?: number
  magicSelectMode?: boolean
  onMagicPointClick?: (x: number, y: number) => void
}

export default function CanvasEditor({
  containerWidth,
  containerHeight,
  stageRef: externalStageRef,
  zoomMultiplier = 1,
  magicSelectMode = false,
  onMagicPointClick,
}: CanvasEditorProps) {
  const { layers, selectedLayerId, setSelectedLayerId, updateLayer, canvasWidth, canvasHeight } =
    useEditorStore()

  const internalStageRef = useRef<any>(null)
  const stageRef = externalStageRef ?? internalStageRef
  const trRef = useRef<any>(null)
  const [fitScale, setFitScale] = useState(1)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState('')

  useEffect(() => {
    if (!containerWidth || !containerHeight) return
    const scaleX = (containerWidth - 48) / canvasWidth
    const scaleY = (containerHeight - 48) / canvasHeight
    setFitScale(Math.min(scaleX, scaleY, 1))
  }, [containerWidth, containerHeight, canvasWidth, canvasHeight])

  const scale = fitScale * zoomMultiplier

  useEffect(() => {
    if (!trRef.current || !stageRef.current) return
    if (selectedLayerId && !editingTextId && !magicSelectMode) {
      const node = stageRef.current.findOne(`#${selectedLayerId}`)
      if (node) {
        trRef.current.nodes([node])
        trRef.current.getLayer()?.batchDraw()
        return
      }
    }
    trRef.current.nodes([])
    trRef.current.getLayer()?.batchDraw()
  }, [selectedLayerId, layers, editingTextId, magicSelectMode, stageRef])

  const handleStageClick = useCallback(
    (e: any) => {
      if (magicSelectMode && onMagicPointClick) {
        const stage = e.target.getStage()
        const pos = stage?.getPointerPosition()
        if (pos) {
          onMagicPointClick(pos.x / scale, pos.y / scale)
        }
        return
      }
      if (e.target === e.target.getStage() || e.target.getAttr('data-bg') === true) {
        setSelectedLayerId(null)
      }
    },
    [magicSelectMode, onMagicPointClick, scale, setSelectedLayerId]
  )

  const selectedLayer = layers.find((l) => l.id === selectedLayerId)
  const editingLayer = layers.find((l) => l.id === editingTextId)
  const isLocked = selectedLayer?.locked ?? false

  const scaledWidth = canvasWidth * scale
  const scaledHeight = canvasHeight * scale

  const commitTextEdit = () => {
    if (editingTextId) {
      updateLayer(editingTextId, { text: editingTextValue })
      setEditingTextId(null)
    }
  }

  return (
    <div
      className="flex items-center justify-center w-full h-full overflow-auto p-6"
      style={{ background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%) 0 0 / 20px 20px' }}
    >
      <div
        className="relative shadow-2xl shrink-0"
        style={{
          width: scaledWidth,
          height: scaledHeight,
          cursor: magicSelectMode ? 'crosshair' : 'default',
        }}
      >
        <Stage
          ref={stageRef}
          width={scaledWidth}
          height={scaledHeight}
          scaleX={scale}
          scaleY={scale}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fill="white"
              listening={true}
              data-bg={true}
              onClick={handleStageClick}
            />

            {layers.map((layer) => {
              if (!layer.visible) return null
              const onSelect = () => {
                if (magicSelectMode) return
                setSelectedLayerId(layer.id)
              }

              if (layer.type === 'image') {
                return (
                  <ImageElement
                    key={layer.id}
                    layer={layer}
                    onSelect={onSelect}
                  />
                )
              }
              if (layer.type === 'text') {
                return (
                  <TextElement
                    key={layer.id}
                    layer={layer}
                    isEditing={editingTextId === layer.id}
                    onSelect={onSelect}
                    onStartEdit={() => {
                      setEditingTextId(layer.id)
                      setEditingTextValue(layer.text ?? '')
                    }}
                  />
                )
              }
              if (layer.type === 'shape') {
                return (
                  <ShapeElement
                    key={layer.id}
                    layer={layer}
                    onSelect={onSelect}
                  />
                )
              }
              return null
            })}

            <Transformer
              ref={trRef}
              rotateEnabled={!isLocked}
              resizeEnabled={!isLocked}
              enabledAnchors={
                isLocked
                  ? []
                  : ['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left']
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox
                return newBox
              }}
              borderStroke="#000000"
              borderStrokeWidth={1.5}
              anchorStroke="#000000"
              anchorFill="white"
              anchorSize={8}
            />
          </Layer>
        </Stage>

        {/* Inline text editor overlay (Canva-style double-click editing) */}
        {editingLayer && (
          <textarea
            autoFocus
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onBlur={commitTextEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingTextId(null)
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitTextEdit()
              }
            }}
            style={{
              position: 'absolute',
              left: editingLayer.x * scale,
              top: editingLayer.y * scale,
              width: Math.max(60, editingLayer.width * scale),
              minHeight: Math.max(24, (editingLayer.fontSize ?? 16) * scale * 1.4),
              fontSize: (editingLayer.fontSize ?? 16) * scale,
              fontFamily: editingLayer.fontFamily ?? 'Inter, sans-serif',
              fontWeight: editingLayer.fontWeight === 'bold' ? 'bold' : 'normal',
              color: editingLayer.fill ?? '#000000',
              textAlign: editingLayer.textAlign ?? 'left',
              lineHeight: 1.2,
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid #000000',
              outline: 'none',
              padding: '2px 4px',
              resize: 'none',
              overflow: 'hidden',
              zIndex: 30,
            }}
          />
        )}
      </div>
    </div>
  )
}
