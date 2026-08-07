const UTF8_FLAG = 0x0800

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()): { date: number; time: number } {
  return {
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  }
}

function record(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size)
  write(new DataView(bytes.buffer))
  return bytes
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export async function createZipBlob(
  files: Array<{ blob: Blob; filename: string }>,
): Promise<Blob> {
  const encoder = new TextEncoder()
  const localParts: BlobPart[] = []
  const centralParts: BlobPart[] = []
  let localOffset = 0
  let centralSize = 0
  const timestamp = dosDateTime()

  for (const file of files) {
    const name = encoder.encode(file.filename)
    const data = new Uint8Array(await file.blob.arrayBuffer())
    const checksum = crc32(data)
    const localHeader = record(30, (view) => {
      view.setUint32(0, 0x04034b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, UTF8_FLAG, true)
      view.setUint16(10, timestamp.time, true)
      view.setUint16(12, timestamp.date, true)
      view.setUint32(14, checksum, true)
      view.setUint32(18, data.byteLength, true)
      view.setUint32(22, data.byteLength, true)
      view.setUint16(26, name.byteLength, true)
    })
    localParts.push(ownedBuffer(localHeader), ownedBuffer(name), ownedBuffer(data))

    const centralHeader = record(46, (view) => {
      view.setUint32(0, 0x02014b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, 20, true)
      view.setUint16(8, UTF8_FLAG, true)
      view.setUint16(12, timestamp.time, true)
      view.setUint16(14, timestamp.date, true)
      view.setUint32(16, checksum, true)
      view.setUint32(20, data.byteLength, true)
      view.setUint32(24, data.byteLength, true)
      view.setUint16(28, name.byteLength, true)
      view.setUint32(42, localOffset, true)
    })
    centralParts.push(ownedBuffer(centralHeader), ownedBuffer(name))
    centralSize += centralHeader.byteLength + name.byteLength
    localOffset += localHeader.byteLength + name.byteLength + data.byteLength
  }

  const end = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true)
    view.setUint16(8, files.length, true)
    view.setUint16(10, files.length, true)
    view.setUint32(12, centralSize, true)
    view.setUint32(16, localOffset, true)
  })
  return new Blob([...localParts, ...centralParts, ownedBuffer(end)], {
    type: 'application/zip',
  })
}
