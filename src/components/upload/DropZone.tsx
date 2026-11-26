import { useCallback, useState } from 'react'
import { Upload, Image as ImageIcon, AlertCircle } from 'lucide-react'

interface DropZoneProps {
  onFile: (file: File) => void
  accept?: string
  maxSizeMB?: number
  className?: string
  compact?: boolean
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export default function DropZone({
  onFile,
  accept = 'image/jpeg,image/jpg,image/png,image/webp',
  maxSizeMB = 25,
  className = '',
  compact = false,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Unsupported format. Please upload JPG, PNG, or WEBP.')
        return
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File too large. Maximum size is ${maxSizeMB}MB.`)
        return
      }
      onFile(file)
    },
    [onFile, maxSizeMB]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = '' // Reset so same file can be re-uploaded
    },
    [handleFile]
  )

  return (
    <div className={className}>
      <label
        htmlFor="dropzone-file-input"
        className={`
          relative flex flex-col items-center justify-center cursor-pointer
          border-2 border-dashed rounded-2xl transition-all duration-300
          ${compact ? 'p-6 gap-2' : 'p-12 gap-4'}
          ${
            isDragging
              ? 'border-purple-500 bg-purple-50 scale-[1.01] shadow-lg shadow-purple-100'
              : 'border-zinc-300 bg-zinc-50 hover:border-purple-400 hover:bg-purple-50/50'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Upload icon with animation */}
        <div
          className={`
            rounded-2xl flex items-center justify-center transition-all
            ${isDragging ? 'bg-purple-100' : 'bg-white shadow-sm'}
            ${compact ? 'w-12 h-12' : 'w-20 h-20'}
          `}
        >
          {isDragging ? (
            <ImageIcon className={`text-purple-600 ${compact ? 'w-6 h-6' : 'w-10 h-10'}`} />
          ) : (
            <Upload className={`text-zinc-400 ${compact ? 'w-6 h-6' : 'w-10 h-10'}`} />
          )}
        </div>

        {/* Text */}
        <div className={`text-center ${compact ? 'space-y-0.5' : 'space-y-2'}`}>
          <p className={`font-semibold text-zinc-700 ${compact ? 'text-sm' : 'text-base'}`}>
            {isDragging ? 'Drop it here!' : 'Drag and drop your image here'}
          </p>
          <p className={`text-zinc-400 ${compact ? 'text-xs' : 'text-sm'}`}>
            Or{' '}
            <span className="text-purple-600 font-medium underline underline-offset-2">
              browse files from your device
            </span>
          </p>
          {!compact && (
            <p className="text-xs text-zinc-400 mt-1">
              Supports JPG, JPEG, PNG, WEBP · Max {maxSizeMB}MB
            </p>
          )}
        </div>

        <input
          id="dropzone-file-input"
          type="file"
          accept={accept}
          onChange={onInputChange}
          className="sr-only"
        />
      </label>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
