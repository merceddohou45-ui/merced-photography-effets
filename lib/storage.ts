import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PassThrough } from 'stream'
import fs from 'fs'

const R2_BUCKET = process.env.R2_BUCKET || ''
const R2_ENDPOINT = process.env.R2_ENDPOINT || process.env.STORAGE_ENDPOINT || ''

if (!R2_BUCKET || !R2_ENDPOINT) {
  console.warn('R2_BUCKET or R2_ENDPOINT not set — storage functions will fail until configured.')
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || '',
    secretAccessKey: process.env.R2_SECRET_KEY || ''
  },
  forcePathStyle: false
})

export async function uploadStreamToR2(stream: NodeJS.ReadableStream, key: string, contentType = 'application/octet-stream') {
  const pass = new PassThrough()
  stream.pipe(pass)
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: pass,
    ContentType: contentType
  })
  await s3Client.send(command)
  return { key }
}

export async function uploadFileFromPath(filePath: string, key: string, contentType = 'application/octet-stream') {
  const stream = fs.createReadStream(filePath)
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: stream,
    ContentType: contentType
  })
  await s3Client.send(command)
  return { key }
}

export async function deleteFromR2(key: string) {
  const cmd = new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
  await s3Client.send(cmd)
  return true
}

export async function getSignedReadUrl(key: string, expiresInSeconds = 60 * 60) {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  const url = await getSignedUrl(s3Client, cmd, { expiresIn: expiresInSeconds })
  return url
}
