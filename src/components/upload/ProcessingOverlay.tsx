import type { ProcessingProgress } from '../../types'
import { Loader2, AlertCircle } from 'lucide-react'

interface ProcessingOverlayProps {
  progress: ProcessingProgress
}

export default function ProcessingOverlay({ progress }: ProcessingOverlayProps) {
  if (progress.status === 'idle' || progress.status === 'done') return null

  const isError = progress.status === 'error'

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 rounded-xl">
      <div className="flex flex-col items-center gap-3 max-w-xs text-center px-4">
        <div className="w-12 h-12 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center">
          {isError ? (
            <AlertCircle className="w-6 h-6 text-black" />
          ) : (
            <Loader2 className="w-6 h-6 text-black animate-spin" />
          )}
        </div>

        <p className="font-medium text-black text-sm">{progress.message}</p>

        {!isError && progress.percentage > 0 && (
          <>
            <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500">{progress.percentage}%</p>
          </>
        )}
      </div>
    </div>
  )
}
