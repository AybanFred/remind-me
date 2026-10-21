export const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // refuse enormous files before even trying

// Crops the photo to a centred square and shrinks it to size x size pixels as a JPEG.
// Profile pictures are shown small, so this keeps the upload tiny (usually under 50 KB),
// and redrawing on a canvas also strips any location data hidden inside a phone photo.
export async function toSquareJpeg(file, size = 256) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('That image is too large. Choose one under 10 MB.')

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That image format is not supported. Try a JPG or PNG.')
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas
    .getContext('2d')
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image.'))),
      'image/jpeg',
      0.9
    )
  })
}
