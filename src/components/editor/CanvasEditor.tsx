import { useRef, useEffect, useCallback, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Transformer } from 'react-konva'
import useImage from 'use-image'
import { useEditorStore } from '../../store/editorStore'
import type { LayerItem } from '../../types'

// Individual image layer element
function ImageElement({
  layer,
  isSelected,
  onSelect,
}: {
  layer: LayerItem
  isSelected: boolean
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

// Individual text layer element
function TextElement({
  layer,
  isSelected,
  onSelect,
}: {
  layer: LayerItem
  isSelected: boolean
  onSelect: () => void
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
        node.scaleX(1)
        node.scaleY(1)
        updateLayer(layer.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(20, node.width() * scaleX),
          fontSize: Math.max(6, (layer.fontSize ?? 16) * node.scaleY()),
        })
      }}
    />
  )
}

interface CanvasEditorProps {
  containerWidth: number
  containerHeight: number
  stageRef?: React.RefObject<any>
}

export default function CanvasEditor({ containerWidth, containerHeight, stageRef: externalStageRef }: CanvasEditorProps) {
  const { layers, selectedLayerId, setSelectedLayerId, canvasWidth, canvasHeight } =
    useEditorStore()

  const internalStageRef = useRef<any>(null)
  const stageRef = externalStageRef ?? internalStageRef
  const trRef = useRef<any>(null)
  const [scale, setScale] = useState(1)

  // Compute scale to fit canvas in container
  useEffect(() => {
    if (!containerWidth || !containerHeight) return
    const scaleX = (containerWidth - 40) / canvasWidth
    const scaleY = (containerHeight - 40) / canvasHeight
    setScale(Math.min(scaleX, scaleY, 1))
  }, [containerWidth, containerHeight, canvasWidth, canvasHeight])

  // Bind transformer to selected node
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return
    if (selectedLayerId) {
      const node = stageRef.current.findOne(`#${selectedLayerId}`)
      if (node) {
        trRef.current.nodes([node])
        trRef.current.getLayer()?.batchDraw()
        return
      }
    }
    trRef.current.nodes([])
    trRef.current.getLayer()?.batchDraw()
  }, [selectedLayerId, layers])

  const handleStageClick = useCallback(
    (e: any) => {
      if (e.target === e.target.getStage() || e.target.getClassName() === 'Rect') {
        setSelectedLayerId(null)
      }
    },
    [setSelectedLayerId]
  )

  const selectedLayer = layers.find((l) => l.id === selectedLayerId)
  const isLocked = selectedLayer?.locked ?? false

  const scaledWidth = canvasWidth * scale
  const scaledHeight = canvasHeight * scale

  return (
    <div
      className="flex items-center justify-center w-full h-full overflow-auto"
      style={{ background: 'repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%) 0 0 / 20px 20px' }}
    >
      <div
        className="relative shadow-2xl"
        style={{
          width: scaledWidth,
          height: scaledHeight,
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
            {/* White background base */}
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fill="white"
              listening={true}
              onClick={() => setSelectedLayerId(null)}
            />

            {/* Render layers from bottom to top */}
            {layers.map((layer) => {
              if (!layer.visible) return null
              const sel = layer.id === selectedLayerId

              if (layer.type === 'image') {
                return (
                  <ImageElement
                    key={layer.id}
                    layer={layer}
                    isSelected={sel}
                    onSelect={() => setSelectedLayerId(sel ? null : layer.id)}
                  />
                )
              }
              if (layer.type === 'text') {
                return (
                  <TextElement
                    key={layer.id}
                    layer={layer}
                    isSelected={sel}
                    onSelect={() => setSelectedLayerId(sel ? null : layer.id)}
                  />
                )
              }
              return null
            })}

            {/* Transformer for selection */}
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
      </div>
    </div>
  )
}

// Export function for use by EditorPage
export function exportStageToBlob(
  stageRef: React.RefObject<any>,
  format: 'png' | 'jpg',
  pixelRatio = 2
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!stageRef.current) {
      reject(new Error('Stage not initialized'))
      return
    }
    const dataUrl = stageRef.current.toDataURL({
      mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
      pixelRatio,
      quality: 1,
    })
    fetch(dataUrl)
      .then((r) => r.blob())
      .then(resolve)
      .catch(reject)
  })
}
