import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { listFailedJobs } from '../../../lib/queue'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  // Fetch user and check role
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { page = '1', pageSize = '25', status, search, type } = req.query
  const pageNum = Math.max(1, Number(page) || 1)
  const perPage = Math.max(1, Math.min(100, Number(pageSize) || 25))

  try {
    // counts: from DB for media statuses
    const processingCount = await prisma.mediaFile.count({ where: { status: 'processing' } })
    const completedCount = await prisma.mediaFile.count({ where: { status: 'completed' } })
    const failedCount = await prisma.mediaFile.count({ where: { status: 'failed' } })

    // If status filter is 'failed' or type/jobId search, query queue failed jobs
    if (String(status || '').toLowerCase() === 'failed' || type || (search && typeof search === 'string' && search.startsWith('job:'))) {
      const allFailed = await listFailedJobs()
      // filter by type or jobId or mediaId
      let filtered = allFailed as any[]
      if (type) filtered = filtered.filter(j => String(j.name || j.data?.type).toLowerCase() === String(type).toLowerCase())
      if (search && typeof search === 'string') {
        const s = search.replace(/^job:/, '')
        filtered = filtered.filter(j => String(j.id).includes(s) || String(j.data?.mediaId || '').includes(s) || String(j.name || '').includes(s))
      }
      const total = filtered.length
      const start = (pageNum - 1) * perPage
      const pageItems = filtered.slice(start, start + perPage)
      return res.status(200).json({ jobs: pageItems, total, page: pageNum, pageSize: perPage, counts: { processing: processingCount, completed: completedCount, failed: failedCount } })
    }

    // For processing/completed or media-based queries, query the media table
    const whereAny: any = {}
    if (status) whereAny.status = String(status)
    if (search && typeof search === 'string') {
      // allow search by mediaId
      whereAny.OR = [{ id: { contains: search } }, { filename: { contains: search } }]
    }

    const totalMedia = await prisma.mediaFile.count({ where: whereAny })
    const medias = await prisma.mediaFile.findMany({ where: whereAny, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * perPage, take: perPage })

    // Map media entries to a job-like object for UI consistency
    const mapped = medias.map(m => ({ id: m.id, name: m.status, data: { mediaId: m.id }, attemptsMade: null, failedReason: null }))

    return res.status(200).json({ jobs: mapped, total: totalMedia, page: pageNum, pageSize: perPage, counts: { processing: processingCount, completed: completedCount, failed: failedCount } })
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to list failed jobs', detail: e.message })
  }
}
