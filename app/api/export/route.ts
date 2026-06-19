import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { getSignedReadUrl } from '../../../lib/storage'

export async function POST(request: Request) {
  const body = await request.json()
  // Expecting: { mediaId }
  const mediaId = body?.mediaId
  if (!mediaId) return NextResponse.json({ error: 'mediaId required' }, { status: 400 })

  const media = await prisma.mediaFile.findUnique({ where: { id: mediaId } })
  if (!media) return NextResponse.json({ error: 'media not found' }, { status: 404 })

  // Decide final key
  let finalKey: string | null = null
  if (media.watermarkEnabled) {
    if (!media.watermarkApplied) {
      return NextResponse.json({ status: 'processing', message: 'watermark processing pending' }, { status: 202 })
    }
    // watermark applied, final file stored under final/{originalKey}
    finalKey = `final/${media.url}`
  } else if (media.enhancedUrl) {
    finalKey = media.enhancedUrl
  } else {
    finalKey = media.url
  }

  try {
    const signedUrl = await getSignedReadUrl(finalKey, 60 * 60)
    return NextResponse.json({ finalKey, downloadUrl: signedUrl })
  } catch (e: any) {
    return NextResponse.json({ error: 'failed to generate signed url', detail: e.message }, { status: 500 })
  }
}
