function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image for export'))
    image.src = url
  })
}

export async function htmlImageToPngDataUrl(image: HTMLImageElement): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

export async function blobToPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob

  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error('PNG encoding failed'))
        },
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read blob as data URL'))
    }
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'))
    reader.readAsDataURL(blob)
  })
}
