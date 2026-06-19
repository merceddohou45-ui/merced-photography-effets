import UploadDropzone from '../../components/UploadDropzone'
import React, { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [uploaded, setUploaded] = useState<any[]>([])

  const handleComplete = (files: any[]) => {
    // files may be nested; flatten
    const newFiles = files.flatMap((f: any)=> f.files ? f.files : [f])
    setUploaded(prev => [...newFiles, ...prev])
  }

  useEffect(()=>{
    // Optionally fetch recent media files for user
    async function load(){
      try{
        const res = await fetch('/api/projects')
        if (res.ok) {
          const json = await res.json()
          // not directly media files -- placeholder
        }
      }catch(e){/* ignore */}
    }
    load()
  }, [])

  return (
    <section className="container mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="mb-6">Upload media to your projects. Files are stored privately and served via signed URLs.</p>

      <div className="mb-8">
        <UploadDropzone projectId={undefined} onComplete={handleComplete} />
      </div>

      <h2 className="text-2xl font-semibold mb-4">Recently uploaded</h2>
      <div className="grid md:grid-cols-3 gap-4">
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
    </section>
  )
}
