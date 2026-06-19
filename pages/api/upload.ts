import fs from 'fs'
import path from 'path'
import os from 'os'
import { pipeline } from 'stream/promises'
import { prisma } from '../../lib/prisma'
import { uploadStreamToR2, uploadFileFromPath, deleteFromR2, getSignedReadUrl } from '../../lib/storage'
import Busboy from 'busboy'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../lib/auth'
import { randomUUID } from 'crypto'

export const config = {
  api: {
    bodyParser: false,
  }
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
const MAX_FILES = 30
const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB

// lightweight helper to create unique temp files
function tempFilePath(prefix = 'upload') {
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  return path.join(os.tmpdir(), name)
}

// simple filename sanitizer
function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

import { enqueueMediaJob } from '../../lib/queue'

export default async function handler(req: any, res: any) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userEmail = session.user.email
  const user = await prisma.user.findUnique({ where: { email: userEmail } })
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const busboy = new Busboy({ headers: req.headers })
  const createdRecords: any[] = []
  const createdObjects: string[] = []
  let fileCount = 0
  let aborted = false
  const filePromises: Promise<any>[] = []
  let enhanceFlag = false
  const projectIdHeader = req.headers['x-project-id'] as string | undefined

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'enhance' && (val === '1' || val === 'true')) enhanceFlag = true
  })

  busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
    if (aborted) { file.resume(); return }
    fileCount++
    if (fileCount > MAX_FILES) {
      aborted = true
      file.resume()
      return
    }
    if (!ALLOWED_MIME.has(mimetype)) {
      aborted = true
      file.resume()
      return
    }

    const fileId = randomUUID()
    const timestamp = Date.now()
    const safeName = sanitizeFilename(filename)
    const projectId = projectIdHeader || null
    const baseKey = `uploads/${user.id}/${projectId || 'general'}/${timestamp}_${fileId}_${safeName}`

    // images: write to temp file and upload original, then enqueue processing jobs
    if (mimetype.startsWith('image/')) {
      const tmpPath = tempFilePath('img')

      const p = (async () => {
        try {
          // save incoming stream to temp file
          const writeStream = fs.createWriteStream(tmpPath)
          await pipeline(file as any, writeStream)

          // upload original from temp path
          await uploadFileFromPath(tmpPath, baseKey, mimetype)
          createdObjects.push(baseKey)

          // create DB record with processing status and metadata indicating enhancement preference
          const media = await prisma.mediaFile.create({ data: {
            projectId: projectId,
            filename: filename,
            mimeType: mimetype,
            size: fs.statSync(tmpPath).size,
            url: baseKey,
            thumbnail: null,
            enhancedUrl: null,
            metadata: { enhance: !!enhanceFlag },
            status: 'processing'
          }})

          createdRecords.push(media)

          // enqueue thumbnail job
          await enqueueMediaJob({ type: 'generate_thumbnail', mediaId: media.id, key: baseKey, mimeType: mimetype })

          // enqueue enhancement job if requested
          if (enhanceFlag) {
            await enqueueMediaJob({ type: 'enhance_image', mediaId: media.id, key: baseKey, mimeType: mimetype })
          }

          // cleanup temp file
          try { fs.unlinkSync(tmpPath) } catch (e) {}

          const signedUrl = await getSignedReadUrl(baseKey, 60 * 60)
          return { filename, mimeType: mimetype, key: baseKey, signedUrl, media }
        } catch (err: any) {
          try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch (e) {}
          throw err
        }
      })()

      filePromises.push(p)
      return
    }

    // non-image (video) flow — stream directly to R2 to avoid buffering
    const p = (async () => {
      try {
        await uploadStreamToR2(file as any, baseKey, mimetype)
        createdObjects.push(baseKey)
        const media = await prisma.mediaFile.create({ data: {
          projectId: projectId,
          filename: filename,
          mimeType: mimetype,
          size: 0,
          url: baseKey,
          thumbnail: null,
          enhancedUrl: null,
          metadata: { enhance: false },
          status: 'processing'
        }})

        // enqueue placeholder video processing job
        await enqueueMediaJob({ type: 'process_video_thumbnail', mediaId: media.id, key: baseKey, mimeType: mimetype })

        const signedUrl = await getSignedReadUrl(baseKey, 60 * 60)
        return { filename, mimeType: mimetype, key: baseKey, signedUrl, media }
      } catch (err) {
        throw err
      }
    })()

    filePromises.push(p)
  })

  busboy.on('finish', async () => {
    try {
      const results = await Promise.allSettled(filePromises)
      const ok: any[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') ok.push(r.value)
        else {
          // cleanup created objects on failure
          await Promise.all(createdObjects.map(k => deleteFromR2(k).catch(()=>null)))
          return res.status(500).json({ error: 'One or more files failed to upload', detail: r.reason?.message || r.reason })
        }
      }
      return res.status(200).json({ files: ok })
    } catch (err: any) {
      await Promise.all(createdObjects.map(k => deleteFromR2(k).catch(()=>null)))
      return res.status(500).json({ error: 'Upload failed', detail: err.message })
    }
  })

  busboy.on('error', (err) => {
    return res.status(500).json({ error: 'Upload parsing error', detail: err.message })
  })

  req.pipe(busboy)
}
