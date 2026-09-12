import type { LoadedPetPayload, PetJson, PetListItem, PetState } from '@shared/pet'
import type { PetEditorDetail, SavePetInput } from '@shared/settings'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { PET_STATES } from '@shared/pet'
import { app } from 'electron'
import { getMaxPetEdge } from './config'
import { gifDurationMs } from './gif-duration'

const mainDir = path.dirname(fileURLToPath(import.meta.url))

const IMAGE_EXTS = ['gif', 'png', 'webp', 'jpg', 'jpeg']

const MIME: Record<string, string> = {
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

export interface ResolvedPet {
  id: string
  name: string
  dir: string
  files: Partial<Record<PetState, string>> & { idle: string }
  durationsMs: Partial<Record<PetState, number>>
}

export function bundledPetsDir(): string {
  if (app.isPackaged)
    return path.join(process.resourcesPath, 'pets')
  return path.join(mainDir, '../../resources/pets')
}

export function userPetsDir(): string {
  return path.join(app.getPath('userData'), 'pets')
}

export function ensureUserPetsDir(): void {
  fs.mkdirSync(userPetsDir(), { recursive: true })
}

function isPetState(value: string): value is PetState {
  return (PET_STATES as readonly string[]).includes(value)
}

function readPetJson(dir: string): PetJson | null {
  const file = path.join(dir, 'pet.json')
  if (!fs.existsSync(file))
    return null
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as PetJson
    if (!raw?.name || typeof raw.states !== 'object' || !raw.states)
      return null
    return raw
  }
  catch {
    return null
  }
}

function inferPetJson(dir: string, folderName: string): PetJson | null {
  const states: Partial<Record<PetState, string>> = {}
  for (const state of PET_STATES) {
    for (const ext of IMAGE_EXTS) {
      const rel = `${state}.${ext}`
      if (fs.existsSync(path.join(dir, rel))) {
        states[state] = rel
        break
      }
    }
  }
  if (!states.idle)
    return null
  const namePath = path.join(dir, 'name.txt')
  const name = fs.existsSync(namePath)
    ? fs.readFileSync(namePath, 'utf8').trim() || folderName
    : folderName
  return { name, states }
}

function resolvePetJson(dir: string, folderName: string): PetJson | null {
  return readPetJson(dir) ?? inferPetJson(dir, folderName)
}

function resolveStateFile(dir: string, rel: string | undefined): string | undefined {
  if (!rel)
    return undefined
  const abs = path.resolve(dir, rel)
  if (!abs.startsWith(path.resolve(dir)))
    return undefined
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile())
    return undefined
  return abs
}

export function loadPetFromDir(id: string, dir: string): ResolvedPet | null {
  const folderName = path.basename(dir)
  const json = resolvePetJson(dir, folderName)
  if (!json)
    return null

  const files: Partial<Record<PetState, string>> = {}
  for (const [key, rel] of Object.entries(json.states)) {
    if (!isPetState(key) || typeof rel !== 'string')
      continue
    const abs = resolveStateFile(dir, rel)
    if (abs)
      files[key] = abs
  }
  if (!files.idle)
    return null

  const durationsMs: Partial<Record<PetState, number>> = {}
  for (const state of PET_STATES) {
    const abs = files[state]
    if (!abs)
      continue
    const gif = gifDurationMs(fs.readFileSync(abs))
    if (gif)
      durationsMs[state] = gif
  }

  return {
    id,
    name: json.name,
    dir,
    files: files as ResolvedPet['files'],
    durationsMs,
  }
}

function scanRoot(root: string, prefix: 'bundled' | 'user'): ResolvedPet[] {
  if (!fs.existsSync(root))
    return []
  const pets: ResolvedPet[] = []
  for (const name of fs.readdirSync(root)) {
    const dir = path.join(root, name)
    if (!fs.statSync(dir).isDirectory())
      continue
    const pet = loadPetFromDir(`${prefix}/${name}`, dir)
    if (pet)
      pets.push(pet)
  }
  return pets
}

export function listPets(): PetListItem[] {
  return [
    ...scanRoot(bundledPetsDir(), 'bundled'),
    ...scanRoot(userPetsDir(), 'user'),
  ].map(p => ({ id: p.id, name: p.name }))
}

export function loadPetById(id: string): ResolvedPet | null {
  const [prefix, ...rest] = id.split('/')
  const folder = rest.join('/')
  if (!prefix || !folder)
    return null
  if (prefix === 'bundled')
    return loadPetFromDir(id, path.join(bundledPetsDir(), folder))
  if (prefix === 'user')
    return loadPetFromDir(id, path.join(userPetsDir(), folder))
  return null
}

function fileToDataUrl(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase()
  const mime = MIME[ext] ?? 'application/octet-stream'
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

export function toPayload(pet: ResolvedPet): LoadedPetPayload {
  const urls = {} as LoadedPetPayload['urls']
  for (const state of PET_STATES) {
    const file = pet.files[state]
    if (file)
      urls[state] = fileToDataUrl(file)
  }
  urls.idle = fileToDataUrl(pet.files.idle)
  return {
    id: pet.id,
    name: pet.name,
    urls,
    durationsMs: pet.durationsMs,
    maxPetEdge: getMaxPetEdge(),
  }
}

export function getPetEditorDetail(id: string): PetEditorDetail | null {
  const pet = loadPetById(id)
  if (!pet)
    return null
  const previews: Partial<Record<PetState, string>> = {}
  for (const state of PET_STATES) {
    const file = pet.files[state]
    if (file)
      previews[state] = fileToDataUrl(file)
  }
  return {
    id: pet.id,
    name: pet.name,
    editable: pet.id.startsWith('user/'),
    previews,
  }
}

function uniqueUserSlug(base: string): string {
  let slug = base
  let n = 1
  while (fs.existsSync(path.join(userPetsDir(), slug))) {
    slug = `${base}-${n++}`
  }
  return slug
}

function slugFromName(name: string): string {
  const trimmed = name.trim() || 'pet'
  const safe = trimmed.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-')
  return uniqueUserSlug(safe)
}

export function saveUserPet(input: SavePetInput): string {
  const existing = input.id ? loadPetById(input.id) : null
  const slug = input.id?.startsWith('user/')
    ? input.id.slice('user/'.length)
    : slugFromName(input.name)
  const dir = path.join(userPetsDir(), slug)
  fs.mkdirSync(dir, { recursive: true })

  const stateRels: Partial<Record<PetState, string>> = {}
  for (const state of PET_STATES) {
    const src = input.stateFiles[state]
    if (src) {
      const ext = path.extname(src).toLowerCase() || '.png'
      const destName = `${state}${ext}`
      fs.copyFileSync(src, path.join(dir, destName))
      stateRels[state] = destName
      continue
    }
    if (existing?.files[state]) {
      stateRels[state] = path.basename(existing.files[state])
    }
  }

  if (!stateRels.idle)
    throw new Error('至少需要待机图片')

  const json: PetJson = {
    name: input.name.trim() || slug,
    states: stateRels,
  }
  fs.writeFileSync(path.join(dir, 'pet.json'), `${JSON.stringify(json, null, 2)}\n`)
  return `user/${slug}`
}

export function deleteUserPet(id: string): void {
  if (!id.startsWith('user/'))
    throw new Error('只能删除自定义宠物')
  const dir = path.join(userPetsDir(), id.slice('user/'.length))
  fs.rmSync(dir, { recursive: true, force: true })
}

export function fileToPreviewDataUrl(filePath: string): string {
  return fileToDataUrl(filePath)
}
