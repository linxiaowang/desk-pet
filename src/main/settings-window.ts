import type { SavePetInput, SettingsSnapshot } from '@shared/settings'
import type { UpdateCheckResult } from '@shared/update'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { appIconPath } from './app-icon'
import { getMaxPetEdge, setMaxPetEdge } from './config'
import {
  deleteUserPet,
  fileToPreviewDataUrl,
  getPetEditorDetail,
  listPets,
  saveUserPet,
} from './pets'
import { checkForUpdates, openReleasePage } from './updater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let settingsWin: BrowserWindow | null = null

const IMAGE_FILTER = [
  { name: '图片', extensions: ['png', 'gif', 'webp', 'jpg', 'jpeg'] },
]

export interface SettingsHost {
  preloadPath: string
  getActivePetId: () => string
  applyActivePet: (id: string) => void
  reloadActivePet: () => void
}

function loadRoute(win: BrowserWindow, hash: string): void {
  const rendererIndex = path.join(__dirname, '../renderer/index.html')
  if (process.env.ELECTRON_RENDERER_URL)
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)
  else
    win.loadFile(rendererIndex, { hash: hash.replace(/^#?\/?/, '') })
}

export function openSettingsWindow(host: SettingsHost): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 520,
    height: 680,
    minWidth: 420,
    minHeight: 520,
    title: 'DeskPet 设置',
    icon: appIconPath(),
    show: false,
    webPreferences: {
      preload: host.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  settingsWin.on('closed', () => {
    settingsWin = null
  })

  settingsWin.once('ready-to-show', () => {
    settingsWin?.show()
  })

  loadRoute(settingsWin, '/settings')
}

export function registerSettingsIpc(host: SettingsHost): void {
  ipcMain.handle('settings:snapshot', (): SettingsSnapshot => ({
    pets: listPets(),
    activePetId: host.getActivePetId(),
    maxPetEdge: getMaxPetEdge(),
    appVersion: app.getVersion(),
  }))

  ipcMain.handle('settings:getPet', (_e, id: string) => getPetEditorDetail(id))

  ipcMain.handle('settings:pickImage', async () => {
    const parent = settingsWin && !settingsWin.isDestroyed()
      ? settingsWin
      : BrowserWindow.getFocusedWindow()
    const dialogOpts: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: IMAGE_FILTER,
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, dialogOpts)
      : await dialog.showOpenDialog(dialogOpts)
    if (result.canceled || !result.filePaths[0])
      return null
    const filePath = result.filePaths[0]
    return {
      path: filePath,
      preview: fileToPreviewDataUrl(filePath),
    }
  })

  ipcMain.handle('settings:savePet', (_e, input: SavePetInput) => {
    const id = saveUserPet(input)
    host.applyActivePet(id)
    return id
  })

  ipcMain.handle('settings:deletePet', (_e, id: string) => {
    deleteUserPet(id)
    const active = host.getActivePetId()
    if (active === id)
      host.applyActivePet('bundled/default')
  })

  ipcMain.handle('settings:setActivePet', (_e, id: string) => {
    host.applyActivePet(id)
  })

  ipcMain.handle('settings:setMaxPetEdge', (_e, value: number) => {
    setMaxPetEdge(value)
    host.reloadActivePet()
  })

  ipcMain.handle('settings:openSettings', () => {
    openSettingsWindow(host)
  })

  ipcMain.handle('update:check', (): Promise<UpdateCheckResult> => {
    const parent = settingsWin && !settingsWin.isDestroyed() ? settingsWin : undefined
    return checkForUpdates(true, parent)
  })

  ipcMain.handle('update:openReleasePage', () => openReleasePage())
}
