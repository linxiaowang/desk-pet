/** 解析 GIF 全部帧延迟之和（毫秒）。非 GIF 返回 null。 */
export function gifDurationMs(buf: Uint8Array): number | null {
  if (buf.length < 13)
    return null
  const sig = String.fromCharCode(...buf.subarray(0, 6))
  if (sig !== 'GIF87a' && sig !== 'GIF89a')
    return null

  let i = 13
  const packed = buf[10]!
  if (packed & 0x80)
    i += 3 * (2 ** ((packed & 7) + 1))

  let total = 0
  let frames = 0

  while (i < buf.length) {
    const marker = buf[i]!
    if (marker === 0x3B)
      break

    if (marker === 0x21) {
      const label = buf[i + 1]
      if (label === 0xF9 && buf[i + 2] === 4) {
        const delayCs = buf[i + 4]! | (buf[i + 5]! << 8)
        total += (delayCs === 0 ? 10 : delayCs) * 10
        frames++
        i += 8
        continue
      }
      i += 2
      while (i < buf.length && buf[i] !== 0)
        i += buf[i]! + 1
      i++
      continue
    }

    if (marker === 0x2C) {
      if (i + 10 >= buf.length)
        break
      const field = buf[i + 9]!
      i += 10
      if (field & 0x80)
        i += 3 * (2 ** ((field & 7) + 1))
      i++
      while (i < buf.length && buf[i] !== 0)
        i += buf[i]! + 1
      i++
      continue
    }

    break
  }

  return frames > 0 ? total : null
}
