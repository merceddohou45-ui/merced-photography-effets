import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { retryFailedJob } from '../../../lib/queue'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { jobId } = req.body || {}
  if (!jobId) return res.status(400).json({ error: 'jobId required' })

  try {
    const result = await retryFailedJob(jobId)
    return res.status(200).json({ result })
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to retry job', detail: e.message })
  }
}
