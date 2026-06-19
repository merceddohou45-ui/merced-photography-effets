import { NextResponse } from 'next/server'
import { uploadToR2 } from '../../../lib/storage'

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  // This is a placeholder route. In production parse multipart form data,
  // validate files, stream upload directly to R2, and store metadata in DB.

  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  // For now just return a placeholder response.
  return NextResponse.json({ message: 'Upload endpoint placeholder. Implement multipart parsing and R2 upload.' })
}
