import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../resources/pets/default')

function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF
  for (const byte of buf) {
    c ^= byte
    for (let i = 0; i < 8; i++)
      c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
  }
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const src = y * width * 4
    const dst = y * (width * 4 + 1)
    raw[dst] = 0
    rgba.copy(raw, dst + 1, src, src + width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function putCircle(
  rgba: Buffer,
  size: number,
  cx: number,
  cy: number,
  r: number,
  color: [number, number, number, number],
): void {
  const r2 = r * r
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      if (dx * dx + dy * dy > r2)
        continue
      const i = (y * size + x) * 4
      rgba[i] = color[0]
      rgba[i + 1] = color[1]
      rgba[i + 2] = color[2]
      rgba[i + 3] = color[3]
    }
  }
}

function drawBlob(size: number, body: [number, number, number], scale = 1): Buffer {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2 + size * 0.04
  const r = size * 0.38 * scale
  putCircle(rgba, size, cx, cy, r, [...body, 255])
  putCircle(rgba, size, cx - r * 0.32, cy - r * 0.18, r * 0.11, [40, 28, 20, 255])
  putCircle(rgba, size, cx + r * 0.32, cy - r * 0.18, r * 0.11, [40, 28, 20, 255])
  putCircle(rgba, size, cx - r * 0.29, cy - r * 0.21, r * 0.04, [255, 255, 255, 220])
  putCircle(rgba, size, cx + r * 0.35, cy - r * 0.21, r * 0.04, [255, 255, 255, 220])
  return encodePng(size, size, rgba)
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'idle.png'), drawBlob(128, [245, 166, 35]))
fs.writeFileSync(path.join(outDir, 'hover.png'), drawBlob(128, [255, 214, 90]))
fs.writeFileSync(path.join(outDir, 'clicked.png'), drawBlob(160, [255, 111, 97], 1.05))
fs.writeFileSync(path.join(outDir, 'dragging.png'), drawBlob(128, [91, 155, 213]))
console.log(`written ${outDir}`)
