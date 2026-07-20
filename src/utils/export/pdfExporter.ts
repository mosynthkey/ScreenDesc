import type { Exporter, ExportScene } from './types'
import { pngExporter } from './pngExporter'

/**
 * PDF exporter with a stable Exporter interface.
 * Renders the annotated scene to JPEG and embeds it as a single-page PDF.
 * Can later be swapped to pdf-lib / vector text without changing call sites.
 */
export const pdfExporter: Exporter = {
  format: 'pdf',
  async export(scene: ExportScene): Promise<Blob> {
    const pngBlob = await pngExporter.export(scene)
    const bitmap = await createImageBitmap(pngBlob)
    const width = bitmap.width
    const height = bitmap.height

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable for PDF export')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0)
    bitmap.close()

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error('JPEG encoding failed'))
        },
        'image/jpeg',
        0.92,
      )
    })

    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer())
    const pdfBytes = buildJpegPagePdf(jpegBytes, width, height)
    const copy = new ArrayBuffer(pdfBytes.byteLength)
    new Uint8Array(copy).set(pdfBytes)
    return new Blob([copy], { type: 'application/pdf' })
  },
}

function buildJpegPagePdf(
  jpegBytes: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const encoder = new TextEncoder()
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`
  const contentBytes = encoder.encode(content)

  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let cursor = 0

  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk
    parts.push(bytes)
    cursor += bytes.length
  }

  push('%PDF-1.4\n')

  const writeObject = (objectNumber: number, body: string) => {
    offsets[objectNumber] = cursor
    push(`${objectNumber} 0 obj\n${body}\nendobj\n`)
  }

  writeObject(1, '<< /Type /Catalog /Pages 2 0 R >>')
  writeObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  writeObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  )

  offsets[4] = cursor
  push('4 0 obj\n')
  push(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  )
  push(jpegBytes)
  push('\nendstream\nendobj\n')

  writeObject(5, `<< /Length ${contentBytes.length} >>\nstream\n${content}endstream`)

  const xrefOffset = cursor
  let xref = `xref\n0 6\n0000000000 65535 f \n`
  for (let objectNumber = 1; objectNumber <= 5; objectNumber += 1) {
    xref += `${String(offsets[objectNumber] ?? 0).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  push(xref)

  const output = new Uint8Array(cursor)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}
