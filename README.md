# Magic Layer

**Turn Any Image Into Editable Layers.**

## About

**Magic Layer** is a browser-based, AI-powered image editing platform that turns flat images into independently editable layers. Inspired by tools like Canva Magic Layers, Remove.bg, and Photoshop, it separates foreground subjects, secondary graphic elements, and text while reconstructing the background behind them.

Everything runs **100% locally in your browser** using WebAssembly/WebGPU and HTML5 Canvas — no backend server, no database, no API keys, and no account required.

## Features

- **AI Background Remover (`/background-remover`)**
  - On-device background removal powered by `@imgly/background-removal` (`isnet_quint8`)
  - Interactive before/after comparison slider and zoom controls
  - Lossless transparent PNG download
- **Magic Layers (`/magic-layers`)**
  - Extracts salient foreground subjects into separate transparent layers via connected-component grouping
  - Detects residual sharp-edged graphic elements (logos, badges, shapes)
  - Extracts text into editable text layers via `tesseract.js` OCR (with ink color and weight estimation)
  - Reconstructs missing background areas behind separated objects and text using multi-scale diffusion inpainting
- **Layer Editor (`/editor`)**
  - Interactive Konva.js canvas with move, resize, and rotate handles
  - Layers panel (reorder, show/hide, lock/unlock, duplicate, delete, add text)
  - Properties panel (X/Y, width/height, rotation, opacity, font size, weight, color, alignment, letter spacing)
  - Undo/Redo history and keyboard shortcuts (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`, `Ctrl/Cmd+D`, `Delete`)
- **Export Options**
  - **PNG** & **JPG** full composition export
  - **PSD (`.psd`)** multi-layered Photoshop export via `ag-psd`
  - **ZIP** archive containing all individual image layers

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router
- **Canvas & State:** Konva (`konva`, `react-konva`), Zustand
- **On-Device AI & Processing:** `@imgly/background-removal`, `tesseract.js`
- **Export:** `ag-psd`, `jszip`
- **Icons:** `lucide-react`

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```
