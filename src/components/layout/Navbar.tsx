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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-black flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-base tracking-tight text-black">
              Magic Layer
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  location.pathname === link.to
                    ? 'bg-neutral-100 text-black'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/magic-layers"
              className="hidden md:inline-flex items-center px-3.5 py-1.5 rounded-md text-sm font-medium text-white bg-black hover:bg-neutral-800"
            >
              Open Editor
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-md text-neutral-600 hover:bg-neutral-100"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                location.pathname === link.to
                  ? 'bg-neutral-100 text-black'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/magic-layers"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-white bg-black mt-2 text-center"
          >
            Open Editor
          </Link>
        </div>
      )}
    </nav>
  )
}
