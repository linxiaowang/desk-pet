export const PET_STATES = ['idle', 'hover', 'clicked', 'dragging'] as const

export type PetState = typeof PET_STATES[number]

export interface PetJson {
  name: string
  states: Partial<Record<PetState, string>>
}

export interface PetListItem {
  id: string
  name: string
}

export interface LoadedPetPayload {
  id: string
  name: string
  urls: Partial<Record<PetState, string>> & { idle: string }
  durationsMs: Partial<Record<PetState, number>>
  maxPetEdge: number
}

/** 默认显示尺寸（最长边像素） */
export const DEFAULT_MAX_PET_EDGE = 128
/** @deprecated 使用 payload.maxPetEdge */
export const MAX_PET_EDGE = DEFAULT_MAX_PET_EDGE

export const PET_STATE_LABELS: Record<PetState, string> = {
  idle: '待机',
  hover: '悬停',
  clicked: '点击',
  dragging: '拖拽',
}
export const ALPHA_HIT_THRESHOLD = 26
export const DRAG_THRESHOLD_PX = 5
export const CLICKED_STATIC_MS = 400
