import { Link, useNavigate } from 'react-router-dom'
import {
  Layers,
  Eraser,
  ScanText,
  Download,
  Zap,
  Shield,
  Cpu,
  ArrowRight,
  Sparkles,
  Move,
  Eye,
  Lock,
} from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import DropZone from '../components/upload/DropZone'

const features = [
  {
    icon: Eraser,
    title: 'AI Background Removal',
    description: 'One-click background removal with edge precision. Download transparent PNGs instantly.',
    color: 'text-purple-600 bg-purple-50',
    href: '/background-remover',
  },
  {
    icon: Layers,
    title: 'Magic Layers',
    description: 'Transform any flat image into independently editable layers with AI object detection.',
    color: 'text-sky-600 bg-sky-50',
    href: '/magic-layers',
  },
  {
    icon: ScanText,
    title: 'Text Extraction',
    description: 'Extract text from images using OCR. Edit, resize, recolor — text becomes live elements.',
    color: 'text-violet-600 bg-violet-50',
    href: '/magic-layers',
  },
  {
    icon: Download,
    title: 'Professional Export',
    description: 'Export as PNG, JPG, or download all layers as a ZIP. No quality loss.',
    color: 'text-emerald-600 bg-emerald-50',
    href: '/magic-layers',
  },
  {
    icon: Move,
    title: 'Full Layer Editor',
    description: 'Move, resize, rotate, duplicate, and reorder every element independently.',
    color: 'text-orange-600 bg-orange-50',
    href: '/magic-layers',
  },
  {
    icon: Shield,
    title: 'Private by Design',
    description: 'All processing happens on your device. No uploads to servers. No data stored.',
    color: 'text-rose-600 bg-rose-50',
    href: '/',
  },
]

const steps = [
  { step: '01', title: 'Upload Your Image', description: 'Drag & drop or browse. JPG, PNG, WEBP supported up to 25MB.' },
  { step: '02', title: 'AI Processes It', description: 'Our on-device AI analyzes the image, removes backgrounds, and separates objects.' },
  { step: '03', title: 'Edit Every Element', description: 'Move, resize, rotate, recolor, extract text. Full creative control.' },
  { step: '04', title: 'Export & Download', description: 'Download as PNG, JPG, or get all layers in a ZIP archive.' },
]

const stats = [
  { label: 'No API Keys', icon: Lock },
  { label: 'No Backend', icon: Cpu },
  { label: 'No Registration', icon: Eye },
  { label: '100% Private', icon: Shield },
]

export default function HomePage() {
  const navigate = useNavigate()

  const handleFileUpload = (file: File) => {
    const url = URL.createObjectURL(file)
    // Store file reference and navigate to magic layers
    sessionStorage.setItem('pendingImageUrl', url)
    sessionStorage.setItem('pendingImageName', file.name)
    navigate('/magic-layers')
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl translate-x-1/2 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <div className="flex justify-center mb-6 animate-fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by On-Device AI · No API Keys Required
            </span>
          </div>

          {/* Headline */}
          <div className="text-center mb-6 animate-slide-up">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-zinc-900 leading-[1.08]">
              Turn Any Image Into{' '}
              <span className="gradient-text">Editable Layers.</span>
            </h1>
            <p className="mt-6 text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Remove backgrounds, separate objects, extract text, and edit every element
              independently with the power of AI — all running on your device.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-12 animate-slide-up">
            <Link
              to="/magic-layers"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-sky-500 hover:opacity-90 shadow-lg shadow-purple-200 hover:shadow-purple-300 transition-all text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Start Editing Free
            </Link>
            <Link
              to="/background-remover"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm transition-all text-sm"
            >
              <Eraser className="w-4 h-4" />
              Remove Background
            </Link>
          </div>

          {/* Upload Zone */}
          <div className="relative max-w-2xl mx-auto animate-fade-in">
            <DropZone onFile={handleFileUpload} />
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap justify-center gap-6 mt-10 animate-fade-in">
            {stats.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-zinc-500">
                <Icon className="w-4 h-4 text-zinc-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-zinc-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900">
              Everything you need to edit images like a pro
            </h2>
            <p className="mt-3 text-zinc-500 max-w-xl mx-auto">
              A complete image editing toolkit powered by AI, running entirely in your browser.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Link
                key={feature.title}
                to={feature.href}
                className="group bg-white rounded-2xl p-6 border border-zinc-100 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-50 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-zinc-900 mb-2 group-hover:text-purple-700 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
                <div className="flex items-center gap-1 mt-4 text-xs font-medium text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Try it now <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900">
              How Magic Layer works
            </h2>
            <p className="mt-3 text-zinc-500">Four steps from flat image to fully editable layers.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-zinc-200 to-transparent z-0" />
                )}
                <div className="relative bg-white rounded-2xl p-6 border border-zinc-100">
                  <div className="text-xs font-black text-purple-300 mb-3 tracking-wider">{step.step}</div>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-sky-500 mb-4" />
                  <h3 className="font-bold text-zinc-900 mb-2 text-sm">{step.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 bg-gradient-to-br from-purple-600 via-violet-600 to-sky-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Zap className="w-10 h-10 text-white/80 mx-auto mb-4" />
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            One Image. Unlimited Possibilities.
          </h2>
          <p className="text-white/70 mb-8 text-lg">
            Start editing for free. No sign-up. No API keys. No limits.
          </p>
          <Link
            to="/magic-layers"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-purple-700 bg-white hover:bg-zinc-50 shadow-xl transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Open Magic Layer Editor
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-sky-500 flex items-center justify-center">
              <Layers className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm text-zinc-700">Magic Layer</span>
          </div>
          <p className="text-xs text-zinc-400">
            All processing happens locally. Your images never leave your device.
          </p>
        </div>
      </footer>
    </div>
  )
}
