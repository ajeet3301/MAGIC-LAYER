import { create } from 'zustand'
import type { LayerItem, EditorProject, ProcessingProgress } from '../types'

interface HistoryState {
  layers: LayerItem[]
  canvasWidth: number
  canvasHeight: number
}

interface EditorStore {
  // Project
  project: EditorProject | null
  setProject: (project: EditorProject | null) => void

  // Canvas
  canvasWidth: number
  canvasHeight: number
  setCanvasSize: (width: number, height: number) => void

  // Layers
  layers: LayerItem[]
  setLayers: (layers: LayerItem[]) => void
  addLayer: (layer: LayerItem) => void
  updateLayer: (id: string, updates: Partial<LayerItem>) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  reorderLayers: (fromIndex: number, toIndex: number) => void

  // Selection
  selectedLayerId: string | null
  setSelectedLayerId: (id: string | null) => void

  // History (undo/redo)
  history: HistoryState[]
  historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Processing
  processing: ProcessingProgress
  setProcessing: (p: ProcessingProgress) => void

  // Original image
  originalImageUrl: string | null
  setOriginalImageUrl: (url: string | null) => void

  // Reset
  reset: () => void
}

const defaultProcessing: ProcessingProgress = {
  status: 'idle',
  message: '',
  percentage: 0,
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: null,
  setProject: (project) => set({ project }),

  canvasWidth: 800,
  canvasHeight: 600,
  setCanvasSize: (canvasWidth, canvasHeight) => set({ canvasWidth, canvasHeight }),

  layers: [],
  setLayers: (layers) => {
    get().pushHistory()
    set({ layers })
  },
  addLayer: (layer) => {
    get().pushHistory()
    set((state) => ({ layers: [...state.layers, layer] }))
  },
  updateLayer: (id, updates) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }))
  },
  removeLayer: (id) => {
    get().pushHistory()
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== id),
      selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
    }))
  },
  duplicateLayer: (id) => {
    get().pushHistory()
    const state = get()
    const layer = state.layers.find((l) => l.id === id)
    if (!layer) return
    const newLayer: LayerItem = {
      ...layer,
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `${layer.name} Copy`,
      x: layer.x + 20,
      y: layer.y + 20,
    }
    set((s) => ({ layers: [...s.layers, newLayer] }))
  },
  reorderLayers: (fromIndex, toIndex) => {
    get().pushHistory()
    set((state) => {
      const newLayers = [...state.layers]
      const [moved] = newLayers.splice(fromIndex, 1)
      newLayers.splice(toIndex, 0, moved)
      return { layers: newLayers }
    })
  },

  selectedLayerId: null,
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),

  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  pushHistory: () => {
    const { layers, canvasWidth, canvasHeight, history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ layers: JSON.parse(JSON.stringify(layers)), canvasWidth, canvasHeight })
    // Keep max 50 history steps
    if (newHistory.length > 50) newHistory.shift()
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: newHistory.length > 1,
      canRedo: false,
    })
  },
  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    const state = history[newIndex]
    set({
      layers: JSON.parse(JSON.stringify(state.layers)),
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
      selectedLayerId: null,
    })
  },
  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    const state = history[newIndex]
    set({
      layers: JSON.parse(JSON.stringify(state.layers)),
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < history.length - 1,
      selectedLayerId: null,
    })
  },

  processing: defaultProcessing,
  setProcessing: (processing) => set({ processing }),

  originalImageUrl: null,
  setOriginalImageUrl: (url) => set({ originalImageUrl: url }),

  reset: () =>
    set({
      project: null,
      layers: [],
      selectedLayerId: null,
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,
      processing: defaultProcessing,
      originalImageUrl: null,
    }),
}))
