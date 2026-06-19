import React, { useEffect, useState } from 'react'

type FailedJob = {
  id: string
  name: string
  data: any
  attemptsMade?: number
  failedReason?: string
}

export default function AdminJobsPanel() {
  const [jobs, setJobs] = useState<FailedJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [mediaId, setMediaId] = useState('')
  const [media, setMedia] = useState<any | null>(null)
  const [fetchingMedia, setFetchingMedia] = useState(false)

  const fetchJobs = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/jobs/failed')
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setJobs(json.jobs || [])
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ fetchJobs() }, [])

  const retryJob = async (jobId: string) => {
    setRetrying(jobId)
    try {
      const res = await fetch('/api/admin/jobs/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }) })
      if (!res.ok) throw new Error(await res.text())
      await fetchJobs()
      alert('Job requeued')
    } catch (e: any) {
      alert('Retry failed: ' + (e.message || String(e)))
    } finally { setRetrying(null) }
  }

  const fetchMedia = async (id?: string) => {
    const mid = id || mediaId
    if (!mid) return alert('mediaId required')
    setFetchingMedia(true)
    try {
      const res = await fetch(`/api/admin/media/${mid}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setMedia(json.media)
    } catch (e: any) {
      alert('Failed to fetch media: ' + (e.message || String(e)))
    } finally { setFetchingMedia(false) }
  }

  return (
    <div className="p-4 border rounded bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-3">Admin: Failed Jobs</h3>

      <div className="mb-4">
        <button className="px-3 py-1 bg-black text-white rounded" onClick={fetchJobs} disabled={loading}>Refresh</button>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading failed jobs...</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Job ID</th>
              <th className="p-2">Type</th>
              <th className="p-2">Media ID</th>
              <th className="p-2">Attempts</th>
              <th className="p-2">Error</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j)=> (
              <tr key={j.id} className="border-b">
                <td className="p-2 align-top break-all">{String(j.id)}</td>
                <td className="p-2 align-top">{String(j.name || j.data?.type)}</td>
                <td className="p-2 align-top break-all">{String(j.data?.mediaId || j.data?.media_id || j.data?.media)}</td>
                <td className="p-2 align-top">{j.attemptsMade ?? j.data?.attempts}</td>
                <td className="p-2 align-top text-xs text-red-600">{String(j.failedReason || j.data?.failedReason || '')}</td>
                <td className="p-2 align-top">
                  <button className="px-2 py-1 bg-blue-600 text-white rounded mr-2" onClick={()=>retryJob(j.id)} disabled={!!retrying}> {retrying===j.id ? 'Retrying...' : 'Retry'} </button>
                  <button className="px-2 py-1 bg-gray-100 text-black rounded" onClick={()=>{ if (j.data?.mediaId) { setMediaId(j.data.mediaId); fetchMedia(j.data.mediaId) } else alert('no mediaId') }}>Inspect</button>
                </td>
              </tr>
            ))}
            {jobs.length===0 && !loading && <tr><td className="p-4" colSpan={6}>No failed jobs</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-6 border-t pt-4">
        <h4 className="font-medium mb-2">Inspect Media</h4>
        <div className="flex gap-2 mb-2">
          <input className="border p-2 flex-1" placeholder="mediaId" value={mediaId} onChange={e=>setMediaId(e.target.value)} />
          <button className="px-3 py-1 bg-black text-white rounded" onClick={()=>fetchMedia()} disabled={fetchingMedia}>Fetch</button>
        </div>
        {media && (
          <div className="mt-2 bg-gray-50 p-3 rounded text-xs">
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(media, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
