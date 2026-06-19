import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { listFailedJobs } from '../../../lib/queue'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const jobs = await listFailedJobs()
    return res.status(200).json({ jobs })
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to list failed jobs', detail: e.message })
  }
}
