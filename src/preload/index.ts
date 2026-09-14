import type { DeskpetApi } from '../shared/api'
import type { LoadedPetPayload } from '../shared/pet'
import { contextBridge, ipcRenderer } from 'electron'

let lastPet: LoadedPetPayload | null = null
const petListeners = new Set<(pet: LoadedPetPayload) => void>()

ipcRenderer.on('pet:loaded', (_event, pet: LoadedPetPayload) => {
  lastPet = pet
  for (const cb of petListeners)
    cb(pet)
})

const api: DeskpetApi = {
  getPet: () => ipcRenderer.invoke('pet:get'),
  onPetLoaded: (cb) => {
    petListeners.add(cb)
    if (lastPet)
      cb(lastPet)
    return () => {
      petListeners.delete(cb)
    }
  },
  setIgnoreMouse: ignore => ipcRenderer.send('mouse:ignore', ignore),
  resize: (width, height) => ipcRenderer.send('window:resize', { width, height }),
  startDrag: offset => ipcRenderer.invoke('drag:start', offset),
  endDrag: () => ipcRenderer.invoke('drag:end'),
  showMenu: () => ipcRenderer.send('menu:show'),
  openSettings: () => ipcRenderer.invoke('settings:openSettings'),
  getSettingsSnapshot: () => ipcRenderer.invoke('settings:snapshot'),
  getPetEditor: id => ipcRenderer.invoke('settings:getPet', id),
  pickPetImage: () => ipcRenderer.invoke('settings:pickImage'),
  savePet: input => ipcRenderer.invoke('settings:savePet', input),
  deletePet: id => ipcRenderer.invoke('settings:deletePet', id),
  setActivePet: id => ipcRenderer.invoke('settings:setActivePet', id),
  setMaxPetEdge: value => ipcRenderer.invoke('settings:setMaxPetEdge', value),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  openReleasePage: () => ipcRenderer.invoke('update:openReleasePage'),
}

contextBridge.exposeInMainWorld('deskpet', api)
