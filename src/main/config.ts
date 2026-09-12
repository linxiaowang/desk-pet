import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_MAX_PET_EDGE } from '@shared/pet'
import { app } from 'electron'

export interface PersistShape {
  petId?: string
  x?: number
  y?: number
  seen?: boolean
  maxPetEdge?: number
}

function persistPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function readPersist(): PersistShape {
  try {
    return JSON.parse(fs.readFileSync(persistPath(), 'utf8')) as PersistShape
  }
  catch {
    return {}
  }
}

export function writePersist(partial: PersistShape): void {
  const next = { ...readPersist(), ...partial }
  fs.writeFileSync(persistPath(), JSON.stringify(next, null, 2))
}

export function getMaxPetEdge(): number {
  const v = readPersist().maxPetEdge
  if (typeof v === 'number' && v >= 48 && v <= 400)
    return Math.round(v)
  return DEFAULT_MAX_PET_EDGE
}

export function setMaxPetEdge(maxPetEdge: number): void {
  const clamped = Math.min(400, Math.max(48, Math.round(maxPetEdge)))
  writePersist({ maxPetEdge: clamped })
}
