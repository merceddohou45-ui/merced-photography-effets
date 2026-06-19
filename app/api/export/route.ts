import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  // Expected: { projectId, exportOptions }
  // Enqueue an export job (placeholder). In production, push to a job queue (BullMQ, RabbitMQ, etc.)
  const jobId = `job_${Date.now()}`
  return NextResponse.json({ message: 'Export queued', jobId })
}
