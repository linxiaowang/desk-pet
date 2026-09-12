import type { DeskpetApi } from '../shared/api'

declare global {
  interface Window {
    deskpet: DeskpetApi
  }
}

export {}
