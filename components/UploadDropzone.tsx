import React, { useCallback, useEffect, useRef, useState } from 'react'

type UploadFile = {
  id: string
  file: File
  preview: string
  progress: number
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  response?: any
}

export default function UploadDropzone({ projectId, onComplete }: { projectId?: string, onComplete?: (files: any[]) => void }){
  const [files, setFiles] = useState<UploadFile[]>([])
  const [enhance, setEnhance] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onFilesSelected = useCallback((selected: FileList | null) => {
    if (!selected) return
    const arr = Array.from(selected)
    const max = 30
    if (arr.length + files.length > max) {
      alert(`You can only upload up to ${max} files at once.`)
      return
    }
    const mapped = arr.map(f => ({
      id: `${Date.now()}_${f.name}`,
      file: f,
      preview: URL.createObjectURL(f),
      progress: 0,
      status: 'queued'
    }))
    setFiles(prev => [...prev, ...mapped])
  }, [files.length])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    onFilesSelected(e.dataTransfer.files)
  }, [onFilesSelected])

  const openFileDialog = () => inputRef.current?.click()

  const uploadFile = (uf: UploadFile) => {
    return new Promise<void>((resolve) => {
      const allowed = ['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
      if (!allowed.includes(uf.file.type)) {
        setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, status: 'error', error: 'File type not allowed' } : p))
        return resolve()
      }
      if (uf.file.size > 200 * 1024 * 1024) {
        setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, status: 'error', error: 'File size exceeds 200MB' } : p))
        return resolve()
      }

      const xhr = new XMLHttpRequest()
      const form = new FormData()
      form.append('file', uf.file)
      if (projectId) xhr.setRequestHeader('X-Project-Id', projectId)
      if (enhance && uf.file.type.startsWith('image/')) form.append('enhance', 'true')

      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, progress: percent } : p))
        }
      }

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText)
            setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, status: 'done', progress: 100, response: res } : p))
            onComplete?.(res.files || [res])
          } catch (e) {
            setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, status: 'done', progress: 100, response: xhr.responseText } : p))
            onComplete?.([])
          }
        } else {
          setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, status: 'error', error: `Upload failed (${xhr.status})` } : p))
        }
        resolve()
      }

      xhr.onerror = function() {
        setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, status: 'error', error: 'Network error' } : p))
        resolve()
      }

      xhr.open('POST', '/api/upload')
      // cookies will be sent automatically for same-origin requests
      setFiles(prev => prev.map(p => p.id === uf.id ? { ...p, status: 'uploading' } : p))
      xhr.send(form)
    })
  }

  const startUploads = async () => {
    for (const f of files) {
      if (f.status === 'queued' || f.status === 'error') {
        // eslint-disable-next-line no-await-in-loop
        await uploadFile(f)
      }
    }
  }

  useEffect(() => {
    // auto-start when files added
    const queued = files.some(f => f.status === 'queued')
    if (queued) startUploads()
    // cleanup previews on unmount
    return () => files.forEach(f => URL.revokeObjectURL(f.preview))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  const removeFile = (id: string) => setFiles(prev => prev.filter(p => p.id !== id))

  return (
    <div>
      <div onDrop={onDrop} onDragOver={(e)=>e.preventDefault()} className="border-dashed border-2 border-gray-300 p-6 rounded">
        <p className="mb-2">Drag & drop up to 30 photos or videos here (max 200MB each)</p>
        <div className="flex gap-2 justify-center mb-3">
          <button onClick={openFileDialog} className="px-4 py-2 bg-black text-white rounded">Select files</button>
          <label className="ml-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enhance} onChange={(e)=>setEnhance(e.target.checked)} />
            Enhance image quality (AI)
          </label>
        </div>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e)=>onFilesSelected(e.target.files)} />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {files.map(f => (
          <div key={f.id} className="p-3 border rounded">
            <div className="h-40 mb-2 bg-gray-100 flex items-center justify-center">
              {f.file.type.startsWith('image/') ? (
                <img src={f.preview} alt={f.file.name} className="max-h-40" />
              ) : (
                <video src={f.preview} className="max-h-40" controls />
              )}
            </div>
            <div className="text-sm mb-2">{f.file.name}</div>
            <div className="w-full bg-gray-200 h-2 rounded mb-2">
              <div style={{ width: `${f.progress}%` }} className="h-2 bg-black rounded" />
            </div>
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-600">{f.status}</div>
              <div className="flex gap-2">
                {f.status === 'error' && <button className="text-sm text-red-600" onClick={()=>{ setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'queued', error: undefined } : p));}}>Retry</button>}
                <button className="text-sm text-gray-600" onClick={()=>removeFile(f.id)}>Remove</button>
              </div>
            </div>
            {f.error && <div className="text-xs text-red-600 mt-2">{f.error}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
