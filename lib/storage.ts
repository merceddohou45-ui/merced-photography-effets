import { GetObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { s3Client } from './s3-client'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// NOTE: we moved s3Client creation to a separate module to allow reuse

export async function downloadToPath(key: string, destPath: string) {
  const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
  const res = await s3Client.send(cmd)
  const body = res.Body as any
  const writeStream = fs.createWriteStream(destPath)
  await pipeline(body, writeStream)
}

export async function uploadFileFromPath(filePath: string, key: string, contentType = 'application/octet-stream') {
  const stream = fs.createReadStream(filePath)
  const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: stream, ContentType: contentType })
  await s3Client.send(cmd)
  return { key }
}

export async function uploadStreamToR2(stream: NodeJS.ReadableStream, key: string, contentType = 'application/octet-stream') {
  const pass = stream as any
  const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: pass, ContentType: contentType })
  await s3Client.send(cmd)
  return { key }
}

export async function deleteFromR2(key: string) {
  const cmd = new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
  await s3Client.send(cmd)
  return true
}

export async function getSignedReadUrl(key: string, expiresInSeconds = 60 * 60) {
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
  const { s3Client } = await import('./s3-client')
  const url = await getSignedUrl(s3Client, cmd, { expiresIn: expiresInSeconds })
  return url
}
