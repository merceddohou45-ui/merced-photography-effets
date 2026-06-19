// Lightweight image enhancement pipeline using sharp.
// This is a modular, extensible pipeline for future AI integrations.

import sharp from 'sharp'

export type EnhanceOptions = {
  denoise?: boolean
  sharpen?: boolean
  contrast?: boolean
  upscale?: boolean
}

export async function enhanceImage(inputPath: string, outputPath: string, options: EnhanceOptions = {}) {
  // Basic pipeline implemented with sharp. This is NOT a heavy ML model — it's a light enhancement pass.
  let img = sharp(inputPath)

  // Optionally upscale by 2x using Lanczos3 (lightweight)
  if (options.upscale) {
    const metadata = await img.metadata()
    const width = metadata.width ? metadata.width * 2 : undefined
    if (width) img = img.resize({ width, kernel: sharp.kernel.lanczos3 })
  }

  // Denoise: small blur to reduce noise (light)
  if (options.denoise) img = img.blur(0.5)

  // Sharpen: enhance edges slightly
  if (options.sharpen) img = img.sharpen()

  // Contrast: linear contrast improvement
  if (options.contrast) img = img.modulate({ brightness: 1, saturation: 1.05 }).linear(1.08, -10)

  await img.toFile(outputPath)
}
