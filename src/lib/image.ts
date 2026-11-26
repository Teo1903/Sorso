/** Ridimensiona e comprime una foto: full (max 1600px) e miniatura (max 360px). */
export async function processPhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  const bitmap = await loadBitmap(file)
  try {
    const full = await resizeToBlob(bitmap, 1600, 0.8)
    const thumb = await resizeToBlob(bitmap, 360, 0.72)
    return { full, thumb }
  } finally {
    if ('close' in bitmap) bitmap.close()
  }
}

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    // corregge l'orientamento EXIF (foto verticali da telefono)
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // fallback per formati non supportati da createImageBitmap
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function resizeToBlob(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compressione foto fallita'))), 'image/jpeg', quality),
  )
}
