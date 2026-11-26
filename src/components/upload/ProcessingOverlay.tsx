import type { ProcessingProgress } from '../../types'
import { Loader2, AlertCircle } from 'lucide-react'

interface ProcessingOverlayProps {
  progress: ProcessingProgress
}

export default function ProcessingOverlay({ progress }: ProcessingOverlayProps) {
  if (progress.status === 'idle' || progress.status === 'done') return null

  const isError = progress.status === 'error'

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl animate-fade-in">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center">
        {/* Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
            isError ? 'bg-red-50' : 'bg-gradient-to-br from-purple-100 to-sky-100'
          }`}
        >
          {isError ? (
            <AlertCircle className="w-8 h-8 text-red-500" />
          ) : (
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          )}
        </div>

        {/* Message */}
        <div>
          <p className="font-semibold text-zinc-800 text-sm">{progress.message}</p>
          {progress.status === 'loading-model' && (
            <p className="text-xs text-zinc-500 mt-1">
              AI model downloads once and is cached locally
            </p>
          )}
        </div>

        {/* Progress bar */}
        {!isError && progress.percentage > 0 && (
          <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-sky-500 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        )}

        {!isError && progress.percentage > 0 && (
          <p className="text-xs text-zinc-400 font-medium">{progress.percentage}%</p>
        )}
      </div>
    </div>
  )
}
