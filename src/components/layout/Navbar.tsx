import { Link, useLocation } from 'react-router-dom'
import { Layers, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Background Remover', to: '/background-remover' },
  { label: 'Magic Layers', to: '/magic-layers' },
]

export default function Navbar() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-sky-500 flex items-center justify-center shadow-lg group-hover:shadow-purple-300 transition-shadow">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              <span className="gradient-text">Magic</span>
              <span className="text-zinc-800"> Layer</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA + Mobile toggle */}
          <div className="flex items-center gap-3">
            <Link
              to="/magic-layers"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-sky-500 hover:opacity-90 shadow-md hover:shadow-purple-200 transition-all"
            >
              <Layers className="w-4 h-4" />
              Start Editing Free
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-600 hover:bg-zinc-100"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-100 bg-white px-4 py-3 space-y-1 animate-fade-in">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-2 rounded-lg text-sm font-medium ${
                location.pathname === link.to
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/magic-layers"
            onClick={() => setMobileOpen(false)}
            className="block px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-sky-500 mt-2"
          >
            Start Editing Free
          </Link>
        </div>
      )}
    </nav>
  )
}
