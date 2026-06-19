Updated upload system: pages/api/upload handles multipart streamed uploads to Cloudflare R2, storage helpers in lib/storage, and frontend UploadDropzone with per-file progress and previews.

Notes:
- This branch adds dependencies: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, busboy, sharp.
- Configure R2 via env: R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY
- Storage is private; API returns short-lived signed URLs for immediate preview.
- Thumbnails: image thumbnail generation is prepared but not fully buffered; video thumbnails are left null for future worker.
