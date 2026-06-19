export type MediaJob = {
  type: 'generate_thumbnail' | 'enhance_image' | 'process_video_thumbnail' | 'apply_watermark'
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
