import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { app, nativeImage } from 'electron'

const mainDir = path.dirname(fileURLToPath(import.meta.url))

export function appIconPath(): string | undefined {
  const candidates = [
    path.join(app.getAppPath(), 'build/icon.png'),
    path.join(mainDir, '../../build/icon.png'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate))
      return candidate
  }
  return undefined
}

export function applyAppIcon(): void {
  const iconPath = appIconPath()
  if (!iconPath)
    return
  const image = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin')
    app.dock?.setIcon(image)
}
