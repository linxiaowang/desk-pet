import type { LoadedPetPayload } from '@shared/pet'
import type { PetEditorDetail, PickImageResult, SavePetInput, SettingsSnapshot } from '@shared/settings'
import type { UpdateCheckResult } from '@shared/update'

export interface DeskpetApi {
  getPet: () => Promise<LoadedPetPayload | null>
  onPetLoaded: (cb: (pet: LoadedPetPayload) => void) => () => void
  setIgnoreMouse: (ignore: boolean) => void
  resize: (width: number, height: number) => void
  startDrag: (offset: { offsetX: number, offsetY: number }) => Promise<void>
  endDrag: () => Promise<void>
  showMenu: () => void
  openSettings: () => Promise<void>
  getSettingsSnapshot: () => Promise<SettingsSnapshot>
  getPetEditor: (id: string) => Promise<PetEditorDetail | null>
  pickPetImage: () => Promise<PickImageResult | null>
  savePet: (input: SavePetInput) => Promise<string>
  deletePet: (id: string) => Promise<void>
  setActivePet: (id: string) => Promise<void>
  setMaxPetEdge: (value: number) => Promise<void>
  checkForUpdates: () => Promise<UpdateCheckResult>
  openReleasePage: () => Promise<void>
}
