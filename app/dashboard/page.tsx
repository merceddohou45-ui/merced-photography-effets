import UploadDropzone from '../../components/UploadDropzone'
import AdminJobsPanel from '../../components/AdminJobsPanel'
import React, { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [uploaded, setUploaded] = useState<any[]>([])
  const [watermarkEnabled, setWatermarkEnabled] = useState(false)
  const [watermarkText, setWatermarkText] = useState('@yourname')
  const [watermarkPosition, setWatermarkPosition] = useState('bottom-right')
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.8)
  const [watermarkSize, setWatermarkSize] = useState('medium')

  const handleComplete = (files: any[]) => {
    const newFiles = files.flatMap((f: any)=> f.files ? f.files : [f])
    setUploaded(prev => [...newFiles, ...prev])
  }

  useEffect(()=>{
    async function load(){
      try{
        const res = await fetch('/api/projects')
        if (res.ok) {
          const json = await res.json()
        }
      }catch(e){/* ignore */}
    }
    load()
  }, [])

  const watermarkSettings = {
    enabled: watermarkEnabled,
    text: watermarkText,
    position: watermarkPosition,
    opacity: watermarkOpacity,
    size: watermarkSize
  }

  const showAdmin = typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_ENABLE_ADMIN_UI === 'true')

  return (
    <section className="container mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="mb-6">Upload media to your projects. Files are stored privately and served via signed URLs.</p>

      <div className="mb-8 grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Watermark</h2>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={watermarkEnabled} onChange={(e)=>setWatermarkEnabled(e.target.checked)} /> Enable watermark
          </label>
          <label className="block mb-2">
            <div className="text-sm">Text</div>
            <input className="border p-2 w-full" value={watermarkText} onChange={(e)=>setWatermarkText(e.target.value)} />
          </label>
          <label className="block mb-2">
            <div className="text-sm">Position</div>
            <select className="border p-2 w-full" value={watermarkPosition} onChange={(e)=>setWatermarkPosition(e.target.value)}>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
              <option value="center">Center</option>
            </select>
          </label>
          <label className="block mb-2">
            <div className="text-sm">Opacity: {watermarkOpacity}</div>
            <input type="range" min="0.1" max="1" step="0.05" value={watermarkOpacity} onChange={(e)=>setWatermarkOpacity(Number(e.target.value))} />
          </label>
          <label className="block mb-2">
            <div className="text-sm">Size</div>
            <select className="border p-2 w-full" value={watermarkSize} onChange={(e)=>setWatermarkSize(e.target.value)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>

        <div className="md:col-span-2">
          <UploadDropzone projectId={undefined} onComplete={handleComplete} watermark={watermarkSettings} />
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4">Recently uploaded</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {uploaded.length === 0 && <div className="text-sm text-gray-600">No uploads yet.</div>}
        {uploaded.map((u, idx) => (
          <div key={idx} className="border p-3 rounded">
            <div className="text-sm font-medium">{u.media?.filename || u.filename}</div>
            <div className="text-xs text-gray-600">{u.media?.mimeType || u.mimeType}</div>
            <div className="mt-2">
              {u.signedUrl ? (
                u.media?.mimeType?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.signedUrl} alt={u.media?.filename} className="max-h-40" />
                ) : (
                  <video src={u.signedUrl} controls className="max-h-40" />
                )
              ) : (
                <span className="text-xs text-gray-500">Processing...</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdmin && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Admin</h2>
          <AdminJobsPanel />
        </div>
      )}

    </section>
  )
}
