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
        setError('Unsupported format. Use JPG, PNG, or WEBP.')
        return
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File exceeds ${maxSizeMB}MB limit.`)
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
      e.target.value = ''
    },
    [handleFile]
  )

  return (
    <div className={className}>
      <label
        htmlFor="dropzone-file-input"
        className={`
          relative flex flex-col items-center justify-center cursor-pointer
          border border-dashed rounded-xl transition-colors
          ${compact ? 'p-6 gap-2' : 'p-12 gap-3'}
          ${
            isDragging
              ? 'border-black bg-neutral-100'
              : 'border-neutral-300 bg-neutral-50 hover:border-black hover:bg-neutral-100/60'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div
          className={`
            rounded-lg flex items-center justify-center border border-neutral-200 bg-white
            ${compact ? 'w-10 h-10' : 'w-12 h-12'}
          `}
        >
          {isDragging ? (
            <ImageIcon className={`text-black ${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
          ) : (
            <Upload className={`text-neutral-700 ${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
          )}
        </div>

        <div className="text-center space-y-1">
          <p className={`font-medium text-black ${compact ? 'text-sm' : 'text-base'}`}>
            {isDragging ? 'Drop image' : 'Drag and drop image'}
          </p>
          <p className="text-xs text-neutral-500">
            or <span className="text-black underline underline-offset-2">browse</span> · JPG, PNG, WEBP
          </p>
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
        <div className="mt-3 flex items-center gap-2 text-xs text-black bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
