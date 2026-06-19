import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const projects = await prisma.project.findMany({ take: 20 })
  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  const body = await request.json()
  // Expected: { userId, title, description }
  const project = await prisma.project.create({ data: {
    title: body.title || 'Untitled Project',
    description: body.description || null,
    userId: body.userId
  }})
  return NextResponse.json({ project })
}
