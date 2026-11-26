import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import BackgroundRemoverPage from './pages/BackgroundRemoverPage'
import MagicLayersPage from './pages/MagicLayersPage'
import EditorPage from './pages/EditorPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/background-remover" element={<BackgroundRemoverPage />} />
        <Route path="/magic-layers" element={<MagicLayersPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
