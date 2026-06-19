import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' })

  try {
    const media = await prisma.mediaFile.findUnique({ where: { id } })
    if (!media) return res.status(404).json({ error: 'media not found' })
    return res.status(200).json({ media })
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch media', detail: e.message })
  }
}
