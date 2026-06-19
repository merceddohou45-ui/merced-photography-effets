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
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState('failed')
  const [query, setQuery] = useState('')
  const [counts, setCounts] = useState({ processing: 0, completed: 0, failed: 0 })

  const fetchJobs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (statusFilter) params.set('status', statusFilter)
      if (query) params.set('search', query)
      const res = await fetch('/api/admin/jobs/failed?' + params.toString())
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setJobs(json.jobs || [])
      setCounts(json.counts || { processing: 0, completed: 0, failed: 0 })
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ fetchJobs() }, [page, statusFilter, query])

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
      <h3 className="text-lg font-semibold mb-3">Admin: Jobs</h3>

      <div className="mb-4 flex items-center gap-3">
        <button className={`px-3 py-1 rounded ${statusFilter==='failed' ? 'bg-black text-white' : 'bg-gray-100'}`} onClick={()=>{ setStatusFilter('failed'); setPage(1) }}>Failed ({counts.failed})</button>
        <button className={`px-3 py-1 rounded ${statusFilter==='processing' ? 'bg-black text-white' : 'bg-gray-100'}`} onClick={()=>{ setStatusFilter('processing'); setPage(1) }}>Processing ({counts.processing})</button>
        <button className={`px-3 py-1 rounded ${statusFilter==='completed' ? 'bg-black text-white' : 'bg-gray-100'}`} onClick={()=>{ setStatusFilter('completed'); setPage(1) }}>Completed ({counts.completed})</button>

        <div className="ml-auto flex items-center gap-2">
          <input className="border p-2" placeholder="search jobId/mediaId/type" value={query} onChange={(e)=>{ setQuery(e.target.value); setPage(1) }} />
          <button className="px-3 py-1 bg-black text-white rounded" onClick={fetchJobs}>Search</button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading...</div>}
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
            {jobs.length===0 && !loading && <tr><td className="p-4" colSpan={6}>No jobs</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="px-3 py-1 bg-gray-100 rounded" onClick={()=>setPage(p => Math.max(1, p-1))}>Previous</button>
        <div>Page {page}</div>
        <button className="px-3 py-1 bg-gray-100 rounded" onClick={()=>setPage(p => p + 1)}>Next</button>
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
