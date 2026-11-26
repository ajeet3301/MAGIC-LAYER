import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import DropZone from '../components/upload/DropZone'

export default function HomePage() {
  const navigate = useNavigate()

  const handleFileUpload = (file: File) => {
    const url = URL.createObjectURL(file)
    sessionStorage.setItem('pendingImageUrl', url)
    sessionStorage.setItem('pendingImageName', file.name)
    navigate('/magic-layers')
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center pt-20 pb-16 px-4 sm:px-6">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-black">
            Turn Any Image Into Editable Layers.
          </h1>
          <p className="mt-4 text-base text-neutral-600">
            Remove backgrounds, separate objects, and extract text.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mt-8 mb-10">
            <Link
              to="/magic-layers"
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-black hover:bg-neutral-800"
            >
              Magic Layers
            </Link>
            <Link
              to="/background-remover"
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-black bg-white border border-neutral-300 hover:border-black"
            >
              Background Remover
            </Link>
          </div>

          <DropZone onFile={handleFileUpload} />
        </div>
      </main>

      <footer className="py-6 border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-neutral-500">
          <span className="font-medium text-black">Magic Layer</span>
          <span>Local browser processing</span>
        </div>
      </footer>
    </div>
  )
}
