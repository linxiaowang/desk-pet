import type { LoadedPetPayload } from '@shared/pet'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, screen } from 'electron'
import { appIconPath, applyAppIcon } from './app-icon'
import { readPersist, writePersist } from './config'
import { bundledPetsDir, ensureUserPetsDir, listPets, loadPetById, toPayload } from './pets'
import { openSettingsWindow, registerSettingsIpc } from './settings-window'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let win: BrowserWindow | null = null
let currentPetId = 'bundled/default'
let overlaying = false
let placed = false
let dragTimer: ReturnType<typeof setInterval> | null = null

const preloadPath = path.join(__dirname, '../preload/index.mjs')
const rendererIndex = path.join(__dirname, '../renderer/index.html')

const settingsHost = {
  preloadPath,
  getActivePetId: () => currentPetId,
  applyActivePet: (id: string) => showPet(id),
  reloadActivePet: () => showPet(currentPetId),
}

function loadRendererRoute(target: BrowserWindow, hash: string): void {
  const route = hash.startsWith('/') ? hash : `/${hash}`
  if (process.env.ELECTRON_RENDERER_URL)
    target.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${route}`)
  else
    target.loadFile(rendererIndex, { hash: route.replace(/^\//, '') })
}

function clampToWorkArea(x: number, y: number, w: number, h: number): { x: number, y: number } {
  const { workArea } = screen.getDisplayNearestPoint({ x, y })
  return {
    x: Math.round(Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - w)),
    y: Math.round(Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - h)),
  }
}

function resizeKeepingFeet(width: number, height: number): void {
  if (!win || overlaying)
    return
  const [x, y] = win.getPosition()
  const [ow, oh] = win.getSize()
  const nx = Math.round(x + ow / 2 - width / 2)
  const ny = Math.round(y + oh - height)
  const pos = clampToWorkArea(nx, ny, width, height)
  win.setBounds({ ...pos, width, height })
}

function defaultCenter(w: number, h: number): { x: number, y: number } {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: Math.round(workArea.x + (workArea.width - w) / 2),
    y: Math.round(workArea.y + (workArea.height - h) / 2),
  }
}

function applySavedPosition(w: number, h: number): void {
  if (!win)
    return
  const saved = readPersist()
  const raw = (saved.seen && saved.x != null && saved.y != null)
    ? { x: saved.x, y: saved.y }
    : defaultCenter(w, h)
  const pos = clampToWorkArea(raw.x, raw.y, w, h)
  win.setBounds({ ...pos, width: w, height: h })
}

function sendPet(payload: LoadedPetPayload): void {
  win?.webContents.send('pet:loaded', payload)
}

function showPet(id: string): void {
  const pet = loadPetById(id) ?? loadPetById('bundled/default')
  if (!pet) {
    dialog.showErrorBox(
      'DeskPet',
      `找不到宠物素材。\n已查找：${bundledPetsDir()}`,
    )
    return
  }
  currentPetId = pet.id
  writePersist({ petId: currentPetId })
  sendPet(toPayload(pet))
}

function buildMenu(): Electron.Menu {
  const pets = listPets()
  return Menu.buildFromTemplate([
    {
      label: '选择宠物',
      submenu: pets.map(p => ({
        label: p.name,
        type: 'radio',
        checked: p.id === currentPetId,
        click: () => showPet(p.id),
      })),
    },
    {
      label: '设置…',
      click: () => openSettingsWindow(settingsHost),
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
}

function createWindow(): void {
  const start = defaultCenter(128, 128)

  win = new BrowserWindow({
    x: start.x,
    y: start.y,
    width: 128,
    height: 128,
    icon: appIconPath(),
    show: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.setAlwaysOnTop(true, 'floating', 1)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true, { forward: true })
  win.moveTop()

  win.on('moved', () => {
    if (!win || overlaying)
      return
    const [x, y] = win.getPosition()
    writePersist({ x, y })
  })

  win.webContents.on('did-finish-load', () => {
    const saved = readPersist()
    showPet(saved.petId ?? 'bundled/default')
  })

  loadRendererRoute(win, '/')
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.whenReady().then(() => {
  ensureUserPetsDir()
  applyAppIcon()
  registerSettingsIpc(settingsHost)

  ipcMain.handle('pet:get', () => {
    const pet = loadPetById(currentPetId) ?? loadPetById('bundled/default')
    return pet ? toPayload(pet) : null
  })

  ipcMain.on('mouse:ignore', (_e, ignore: boolean) => {
    if (!win || overlaying)
      return
    if (ignore)
      win.setIgnoreMouseEvents(true, { forward: true })
    else
      win.setIgnoreMouseEvents(false)
  })

  ipcMain.on('window:resize', (_e, size: { width: number, height: number }) => {
    if (!win)
      return
    const { width, height } = size
    if (!placed) {
      placed = true
      applySavedPosition(width, height)
      win.show()
      return
    }
    resizeKeepingFeet(width, height)
  })

  ipcMain.handle('drag:start', (_e, offset: { offsetX: number, offsetY: number }) => {
    if (!win)
      return
    overlaying = true
    win.setIgnoreMouseEvents(false)
    const tick = (): void => {
      if (!win)
        return
      const p = screen.getCursorScreenPoint()
      win.setPosition(Math.round(p.x - offset.offsetX), Math.round(p.y - offset.offsetY))
    }
    tick()
    if (dragTimer)
      clearInterval(dragTimer)
    dragTimer = setInterval(tick, 8)
  })

  ipcMain.handle('drag:end', () => {
    if (dragTimer) {
      clearInterval(dragTimer)
      dragTimer = null
    }
    overlaying = false
    if (!win)
      return
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    const clamped = clampToWorkArea(x, y, width, height)
    win.setBounds({ ...clamped, width, height })
    writePersist({ x: clamped.x, y: clamped.y, seen: true })
  })

  ipcMain.on('menu:show', () => {
    buildMenu().popup({ window: win ?? undefined })
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit()
})
