import { Queue, QueueScheduler } from 'bullmq'
import { EventEmitter } from 'events'

const REDIS_URL = process.env.REDIS_URL || ''
const QUEUE_NAME = 'media-processing-queue'

let emitter: EventEmitter | null = null
let queue: Queue | null = null
let scheduler: QueueScheduler | null = null

let inMemoryFailedJobs: any[] = []

if (REDIS_URL) {
  try {
    queue = new Queue(QUEUE_NAME, { connection: { url: REDIS_URL } })
    scheduler = new QueueScheduler(QUEUE_NAME, { connection: { url: REDIS_URL } })
    // Note: Worker is created in workers/media-worker.ts
    console.log('Connected to Redis for job queue')
  } catch (e) {
    console.warn('Failed to initialize Redis queue, falling back to in-memory', e)
    emitter = new EventEmitter()
  }
} else {
  emitter = new EventEmitter()
}

export type MediaJob = {
  type: 'generate_thumbnail' | 'enhance_image' | 'process_video_thumbnail' | 'apply_watermark'
  mediaId: string
  key: string
  mimeType: string
  attempts?: number
  jobId?: string
}

export async function enqueueMediaJob(job: MediaJob) {
  if (queue) {
    // use BullMQ queue - job.id will be assigned by BullMQ
    await queue.add(job.type, job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
  } else if (emitter) {
    // simple in-memory invoke
    // include attempts counter and a lightweight jobId
    const payload: MediaJob = { ...job, attempts: job.attempts || 0, jobId: `im_${Date.now()}_${Math.random().toString(36).slice(2,8)}` }
    setImmediate(() => emitter!.emit('job', payload))
    return payload.jobId
  } else {
    throw new Error('No queue backend available')
  }
}

export function onInMemoryJob(handler: (job: MediaJob) => Promise<void>) {
  if (!emitter) return
  emitter.on('job', async (j: MediaJob) => {
    try {
      await handler(j)
    } catch (e) {
      // retry logic for in-memory: re-enqueue up to 3 times
      j.attempts = (j.attempts || 0) + 1
      if (j.attempts < 3) {
        setTimeout(() => emitter!.emit('job', j), 1000 * j.attempts)
      } else {
        console.error('Job failed after retries (in-memory)', j, e)
        inMemoryFailedJobs.push({ ...j, failedReason: (e && e.message) || String(e), failedAt: new Date().toISOString() })
      }
    }
  })
}

export async function listFailedJobs() {
  if (queue) {
    // BullMQ: fetch failed jobs
    try {
      const jobs = await queue.getJobs(['failed'], 0, 100)
      return jobs.map(j => ({ id: j.id, name: j.name, data: j.data, attemptsMade: j.attemptsMade, failedReason: (j.failedReason || null) }))
    } catch (e) {
      console.error('Failed to list jobs from Redis queue', e)
      return []
    }
  }
  // in-memory fallback
  return inMemoryFailedJobs
}

export async function retryFailedJob(jobId: string) {
  if (queue) {
    try {
      const existing = await queue.getJob(jobId)
      if (!existing) throw new Error('Job not found')
      const name = existing.name
      const data = existing.data as MediaJob
      // re-add job to queue
      const newJob = await queue.add(name, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
      // remove old failed job
      await existing.remove()
      return { oldJobId: jobId, requeuedJobId: newJob.id }
    } catch (e) {
      throw e
    }
  }
  // in-memory fallback: find job in failed list and re-emit
  const idx = inMemoryFailedJobs.findIndex((j:any) => j.jobId === jobId)
  if (idx === -1) throw new Error('In-memory failed job not found')
  const job = inMemoryFailedJobs.splice(idx, 1)[0]
  // reset attempts and re-emit
  const payload = { ...job, attempts: 0 }
  setImmediate(() => emitter!.emit('job', payload))
  return { oldJobId: jobId, requeuedJobId: payload.jobId }
}
