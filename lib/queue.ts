import { Queue, QueueScheduler, Worker, Job } from 'bullmq'
import { EventEmitter } from 'events'

const REDIS_URL = process.env.REDIS_URL || ''
const QUEUE_NAME = 'media-processing-queue'

let emitter: EventEmitter | null = null
let queue: Queue | null = null
let scheduler: QueueScheduler | null = null

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
  type: 'generate_thumbnail' | 'enhance_image' | 'process_video_thumbnail'
  mediaId: string
  key: string
  mimeType: string
  attempts?: number
}

export async function enqueueMediaJob(job: MediaJob) {
  if (queue) {
    await queue.add(job.type, job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
  } else if (emitter) {
    // simple in-memory invoke
    // include attempts counter
    const payload = { ...job, attempts: job.attempts || 0 }
    setImmediate(() => emitter!.emit('job', payload))
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
        console.error('Job failed after retries', j, e)
      }
    }
  })
}
