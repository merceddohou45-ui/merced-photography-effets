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

// import optional enhancer
let enhancer: any = null
try { enhancer = require('../../lib/ai/image-enhance') } catch (e) { enhancer = null }

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

    // handle images via temp-file -> optional enhance -> thumbnail -> upload original+thumbnail
    if (mimetype.startsWith('image/')) {
      const tmpPath = tempFilePath('img')
      const tmpThumb = tempFilePath('thumb')

      const p = (async () => {
        try {
          // save incoming stream to temp file
          const writeStream = fs.createWriteStream(tmpPath)
          await pipeline(file as any, writeStream)

          // Optional enhancement step
          let enhancedPath: string | null = null
          if (enhanceFlag && enhancer && enhancer.enhanceImage) {
            enhancedPath = tempFilePath('enh')
            await enhancer.enhanceImage(tmpPath, enhancedPath, { upscale: false })
          }

          const uploadSourcePath = enhancedPath || tmpPath

          // generate thumbnail using sharp
          try {
            const sharp = require('sharp')
            await sharp(uploadSourcePath).resize({ width: 320 }).toFile(tmpThumb)
          } catch (e) {
            // if thumbnail generation fails, continue without thumbnail
            console.warn('Thumbnail generation failed', e)
          }

          // upload original
          await uploadFileFromPath(uploadSourcePath, baseKey, mimetype)
          createdObjects.push(baseKey)

          // upload thumbnail if exists
          let thumbKey: string | null = null
          if (fs.existsSync(tmpThumb)) {
            thumbKey = `thumbnails/${baseKey}`
            await uploadFileFromPath(tmpThumb, thumbKey, 'image/png')
            createdObjects.push(thumbKey)
          }

          // if enhancement created a separate enhanced file, upload that too (store enhancedUrl)
          let enhancedKey: string | null = null
          if (enhancedPath) {
            enhancedKey = `enhanced/${baseKey}`
            await uploadFileFromPath(enhancedPath, enhancedKey, mimetype)
            createdObjects.push(enhancedKey)
          }

          // create DB record
          const media = await prisma.mediaFile.create({ data: {
            projectId: projectId,
            filename: filename,
            mimeType: mimetype,
            size: fs.statSync(uploadSourcePath).size,
            url: baseKey,
            thumbnail: thumbKey,
            enhancedUrl: enhancedKey,
            metadata: {}
          }})

          // generate signed URLs for preview
          const signedUrl = await getSignedReadUrl(baseKey, 60 * 60)
          const signedThumb = thumbKey ? await getSignedReadUrl(thumbKey, 60 * 60) : null
          const signedEnhanced = enhancedKey ? await getSignedReadUrl(enhancedKey, 60 * 60) : null

          // cleanup temp files
          try { fs.unlinkSync(tmpPath) } catch (e) { /* ignore */ }
          try { if (tmpThumb) fs.unlinkSync(tmpThumb) } catch (e) { /* ignore */ }
          try { if (enhancedPath) fs.unlinkSync(enhancedPath) } catch (e) { /* ignore */ }

          createdRecords.push(media)
          return { filename, mimeType: mimetype, size: media.size, key: baseKey, signedUrl, signedThumb, signedEnhanced, media }
        } catch (err: any) {
          // cleanup temp files
          try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch (e) {}
          try { if (fs.existsSync(tmpThumb)) fs.unlinkSync(tmpThumb) } catch (e) {}
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
        const signedUrl = await getSignedReadUrl(baseKey, 60 * 60)
        const media = await prisma.mediaFile.create({ data: {
          projectId: projectId,
          filename: filename,
          mimeType: mimetype,
          size: 0,
          url: baseKey,
          thumbnail: null,
          enhancedUrl: null,
          metadata: {}
        }})
        // size unknown because streamed; consider updating size via headObject in future
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
