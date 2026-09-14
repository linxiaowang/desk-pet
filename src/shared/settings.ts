import type { PetListItem, PetState } from './pet'

export interface SettingsSnapshot {
  pets: PetListItem[]
  activePetId: string
  maxPetEdge: number
  appVersion: string
}

export interface PetEditorDetail {
  id: string
  name: string
  editable: boolean
  previews: Partial<Record<PetState, string>>
}

export interface SavePetInput {
  id: string | null
  name: string
  stateFiles: Partial<Record<PetState, string>>
}

export interface PickImageResult {
  path: string
  preview: string
}
