import path from 'path'
import os from 'os'
import fs from 'fs'
import { downloadToPath, uploadFileFromPath, deleteFromR2, getSignedReadUrl } from '../lib/storage'
import { prisma } from '../lib/prisma'
import sharp from 'sharp'
import { enhanceImage } from '../lib/ai/image-enhance'
import { onInMemoryJob } from '../lib/queue'

const TEMP_DIR = os.tmpdir()

function tempFilePath(prefix = 'worker') {
  return path.join(TEMP_DIR, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`)
}

async function processGenerateThumbnail(jobData: any) {
  const { mediaId, key } = jobData
  console.log('[worker] generate_thumbnail', mediaId, key)
  const media = await prisma.mediaFile.findUnique({ where: { id: mediaId } })
  if (!media) {
    console.warn('[worker] media not found', mediaId)
    return
  }
  if (media.thumbnail) {
    console.log('[worker] thumbnail already exists, skipping', media.thumbnail)
    return
  }

  const tmpPath = tempFilePath('orig')
  const tmpThumb = tempFilePath('thumb')
  try {
    await downloadToPath(key, tmpPath)
    await sharp(tmpPath).resize({ width: 320 }).toFile(tmpThumb)
    const thumbKey = `thumbnails/${key}`
    await uploadFileFromPath(tmpThumb, thumbKey, 'image/png')
    await prisma.mediaFile.update({ where: { id: mediaId }, data: { thumbnail: thumbKey } })

    // Check completion: if enhancement not requested or enhancedUrl exists, mark completed
    const meta = media.metadata || {}
    const enhanceRequested = meta['enhance'] || false
    const refreshed = await prisma.mediaFile.findUnique({ where: { id: mediaId } })
    if (!enhanceRequested || refreshed?.enhancedUrl) {
      // If watermark not enabled, mark completed. If watermark enabled, leave for watermark job to complete.
      if (!refreshed?.watermarkEnabled) {
        await prisma.mediaFile.update({ where: { id: mediaId }, data: { status: 'completed' } })
      }
    }

    console.log('[worker] thumbnail generated for', mediaId)
  } catch (e) {
    console.error('[worker] generate_thumbnail error', e)
    await prisma.mediaFile.update({ where: { id: mediaId }, data: { status: 'failed' } }).catch(()=>null)
    throw e
  } finally {
    try { fs.unlinkSync(tmpPath) } catch (e) {}
    try { fs.unlinkSync(tmpThumb) } catch (e) {}
  }
}

async function processEnhanceImage(jobData: any) {
  const { mediaId, key } = jobData
  console.log('[worker] enhance_image', mediaId, key)
  const media = await prisma.mediaFile.findUnique({ where: { id: mediaId } })
  if (!media) {
    console.warn('[worker] media not found', mediaId)
    return
  }
  if (media.enhancedUrl) {
    console.log('[worker] enhanced already exists, skipping', media.enhancedUrl)
    return
  }

  const tmpPath = tempFilePath('orig')
  const tmpEnhanced = tempFilePath('enh')
  try {
    await downloadToPath(key, tmpPath)
    await enhanceImage(tmpPath, tmpEnhanced, { denoise: true, sharpen: true, contrast: true, upscale: false })
    const enhancedKey = `enhanced/${key}`
    await uploadFileFromPath(tmpEnhanced, enhancedKey, media.mimeType)
    await prisma.mediaFile.update({ where: { id: mediaId }, data: { enhancedUrl: enhancedKey } })

    // Check completion or enqueue watermark
    const refreshed = await prisma.mediaFile.findUnique({ where: { id: mediaId } })
    if (refreshed?.watermarkEnabled) {
      // enqueue watermark job — ensure queue import only here to avoid circular deps
      const { enqueueMediaJob } = await import('../lib/queue')
      await enqueueMediaJob({ type: 'apply_watermark', mediaId, key: enhancedKey, mimeType: media.mimeType })
    } else {
      if (refreshed?.thumbnail || !(refreshed?.metadata as any)?.enhance) {
        await prisma.mediaFile.update({ where: { id: mediaId }, data: { status: 'completed' } })
      }
    }

    console.log('[worker] enhanced image for', mediaId)
  } catch (e) {
    console.error('[worker] enhance_image error', e)
    await prisma.mediaFile.update({ where: { id: mediaId }, data: { status: 'failed' } }).catch(()=>null)
    throw e
  } finally {
    try { fs.unlinkSync(tmpPath) } catch (e) {}
    try { fs.unlinkSync(tmpEnhanced) } catch (e) {}
  }
}

async function processApplyWatermark(jobData: any) {
  const { mediaId, key } = jobData
  console.log('[worker] apply_watermark', mediaId, key)
  const media = await prisma.mediaFile.findUnique({ where: { id: mediaId } })
  if (!media) {
    console.warn('[worker] media not found', mediaId)
    return
  }
  if (!media.watermarkEnabled) {
    console.log('[worker] watermark not enabled for', mediaId)
    return
  }
  if (media.watermarkApplied) {
    console.log('[worker] watermark already applied, skipping', media.watermarkApplied)
    return
  }

  const sourceKey = media.enhancedUrl || media.url
  const tmpSource = tempFilePath('src')
  const tmpOut = tempFilePath('wm')
  try {
    await downloadToPath(sourceKey, tmpSource)

    // create SVG overlay for text watermark
    const text = media.watermarkText || ''
    const opacity = media.watermarkOpacity ?? 1
    const position = media.watermarkPosition || 'bottom-right'

    const svg = `
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <style>
          .watermark { fill: rgba(255,255,255,${opacity}); font-size: 48px; font-family: Arial, Helvetica, sans-serif; }
        </style>
        <text x="50%" y="50%" text-anchor="middle" class="watermark">${escapeXml(text)}</text>
      </svg>
    `

    // Use sharp to composite SVG over source. Positioning via gravity will be handled by compositing with appropriate top/left computed placement.
    const src = sharp(tmpSource)
    const metadata = await src.metadata()
    // Render svg to buffer scaled relative to image size
    const svgBuffer = Buffer.from(svg)

    // Compute gravity mapping
    const gravity = mapPositionToGravity(position)

    await src.composite([{ input: svgBuffer, gravity: gravity, blend: 'over' }]).toFile(tmpOut)

    const finalKey = `final/${media.url}`
    await uploadFileFromPath(tmpOut, finalKey, media.mimeType)

    await prisma.mediaFile.update({ where: { id: mediaId }, data: { watermarkApplied: true, watermarkText: media.watermarkText, watermarkPosition: media.watermarkPosition, watermarkOpacity: media.watermarkOpacity, status: 'completed' } })

    console.log('[worker] watermark applied for', mediaId)
  } catch (e) {
    console.error('[worker] apply_watermark error', e)
    await prisma.mediaFile.update({ where: { id: mediaId }, data: { status: 'failed' } }).catch(()=>null)
    throw e
  } finally {
    try { fs.unlinkSync(tmpSource) } catch (e) {}
    try { fs.unlinkSync(tmpOut) } catch (e) {}
  }
}

function mapPositionToGravity(position: string) {
  switch (position) {
    case 'top-left': return 'northwest'
    case 'top-right': return 'northeast'
    case 'bottom-left': return 'southwest'
    case 'bottom-right': return 'southeast'
    case 'center': return 'center'
    default: return 'southeast'
  }
}

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"\n]/g, function (c) {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&#39;'
      case '"': return '&quot;'
      case '\n': return '&#10;'
      default: return ''
    }
  })
}

async function processVideoThumbnail(jobData: any) {
  const { mediaId, key } = jobData
  console.log('[worker] process_video_thumbnail (placeholder)', mediaId, key)
  // Placeholder: ffmpeg-based extraction will be implemented later
  // For now mark as processing and leave thumbnail null
  return
}

export async function startWorker() {
  const REDIS_URL = process.env.REDIS_URL || ''
  if (REDIS_URL) {
    try {
      const { Worker } = require('bullmq')
      const worker = new Worker('media-processing-queue', async (job: any) => {
        try {
          switch (job.name) {
            case 'generate_thumbnail':
              await processGenerateThumbnail(job.data)
              break
            case 'enhance_image':
              await processEnhanceImage(job.data)
              break
            case 'apply_watermark':
              await processApplyWatermark(job.data)
              break
            case 'process_video_thumbnail':
              await processVideoThumbnail(job.data)
              break
            default:
              console.warn('[worker] unknown job type', job.name)
          }
        } catch (e) {
          console.error('[worker] job failed', job.name, e)
          throw e
        }
      }, { connection: { url: REDIS_URL } })

      worker.on('completed', (job: any) => console.log('[worker] job completed', job.id, job.name))
      worker.on('failed', (job: any, err: any) => console.error('[worker] job failed', job?.id, err))

      console.log('BullMQ worker started for media-processing-queue')
      return
    } catch (e) {
      console.warn('Failed to start BullMQ worker, falling back to in-memory consumer', e)
    }
  }

  // In-memory fallback
  onInMemoryJob(async (job) => {
    try {
      switch (job.type) {
        case 'generate_thumbnail':
          await processGenerateThumbnail(job)
          break
        case 'enhance_image':
          await processEnhanceImage(job)
          break
        case 'apply_watermark':
          await processApplyWatermark(job)
          break
        case 'process_video_thumbnail':
          await processVideoThumbnail(job)
          break
        default:
          console.warn('[worker] unknown in-memory job', job.type)
      }
    } catch (e) {
      console.error('[worker] in-memory job error', e)
      throw e
    }
  })

  console.log('In-memory media worker listening for jobs')
}

// If this file is executed directly (node workers/media-worker.ts), start the worker
if (require.main === module) {
  startWorker().catch(e => {
    console.error('Worker failed to start', e)
    process.exit(1)
  })
}
