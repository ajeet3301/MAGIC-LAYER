// Core layer/editor types for Magic Layer

export type LayerType = 'image' | 'text' | 'shape' | 'background'

export interface LayerItem {
  id: string
  name: string
  type: LayerType
  visible: boolean
  locked: boolean
  opacity: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  // Image layers
  imageData?: string // base64 PNG data URL
  // Text layers
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  fill?: string
  textAlign?: 'left' | 'center' | 'right'
  letterSpacing?: number
  // Shape layers
  shapeType?: 'rect' | 'circle' | 'triangle'
  shapeFill?: string
  shapeStroke?: string
}

export interface EditorProject {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  canvasWidth: number
  canvasHeight: number
  layers: LayerItem[]
  originalImageUrl?: string
}

export type ProcessingStatus =
  | 'idle'
  | 'loading-model'
  | 'processing'
  | 'done'
  | 'error'

export interface ProcessingProgress {
  status: ProcessingStatus
  message: string
  percentage: number
}

export type ExportFormat = 'png' | 'jpg' | 'zip'

export interface SegmentedObject {
  id: string
  name: string
  maskData: Uint8ClampedArray
  bbox: { x: number; y: number; width: number; height: number }
  imageDataUrl: string
}
