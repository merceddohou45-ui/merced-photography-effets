import { S3Client } from '@aws-sdk/client-s3'

const R2_ENDPOINT = process.env.R2_ENDPOINT || process.env.STORAGE_ENDPOINT || ''

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || '',
    secretAccessKey: process.env.R2_SECRET_KEY || ''
  },
  forcePathStyle: false
})
