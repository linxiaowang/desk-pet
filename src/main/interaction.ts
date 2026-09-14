import type { InteractionConfig, PlayQuoteKind } from '@shared/interaction'
import {
  DEFAULT_BUBBLE_DURATION_MS,
  pickRandomLine,
} from '@shared/interaction'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import type { PetActivityState } from './interaction-store'
import {
  clampInteractionConfig,
  readInteractionConfig,
  writeInteractionConfig,
} from './interaction-store'

const REMINDER_PAUSE_MS = 30 * 60 * 1000

let overlayWin: BrowserWindow | null = null
let config: InteractionConfig = readInteractionConfig()
let petState: PetActivityState = 'idle'
let pauseRemindersUntil = 0
let pendingReminderText: string | null = null
let reminderTimer: ReturnType<typeof setInterval> | null = null
let idleTimer: ReturnType<typeof setInterval> | null = null
let lastReminderAt = Date.now()
let lastIdleQuoteAt = Date.now()
let lastHoverQuoteAt = 0

function getWin(): BrowserWindow | null {
  if (overlayWin && !overlayWin.isDestroyed())
    return overlayWin
  return null
}

function canShowBubble(): boolean {
  return petState !== 'dragging' && petState !== 'clicked'
}

function sendBubble(text: string, durationMs = DEFAULT_BUBBLE_DURATION_MS): void {
  const win = getWin()
  if (!win)
    return
  win.webContents.send('bubble:show', { text, durationMs })
}

function flushPendingReminder(): void {
  if (!pendingReminderText || !canShowBubble())
    return
  sendBubble(pendingReminderText)
  pendingReminderText = null
  lastReminderAt = Date.now()
}

function queueOrShowReminder(text: string): void {
  if (!canShowBubble()) {
    pendingReminderText = text
    return
  }
  sendBubble(text)
  lastReminderAt = Date.now()
}

function tickReminder(): void {
  if (!config.reminderEnabled)
    return
  if (Date.now() < pauseRemindersUntil)
    return
  const intervalMs = config.reminderIntervalMinutes * 60 * 1000
  if (Date.now() - lastReminderAt < intervalMs)
    return
  const line = pickRandomLine(config.reminderMessages)
  if (!line)
    return
  queueOrShowReminder(line)
}

function tickIdleQuote(): void {
  if (config.playQuotesMuted || !config.idleQuotesEnabled)
    return
  if (petState !== 'idle')
    return
  const intervalMs = config.idleIntervalMinutes * 60 * 1000
  if (Date.now() - lastIdleQuoteAt < intervalMs)
    return
  const line = pickRandomLine(config.idleQuotes)
  if (!line)
    return
  if (!canShowBubble())
    return
  sendBubble(line)
  lastIdleQuoteAt = Date.now()
}

function restartTimers(): void {
  if (reminderTimer)
    clearInterval(reminderTimer)
  if (idleTimer)
    clearInterval(idleTimer)
  reminderTimer = setInterval(tickReminder, 60_000)
  idleTimer = setInterval(tickIdleQuote, 60_000)
}

export function bindInteractionOverlay(win: BrowserWindow): void {
  overlayWin = win
}

export function getInteractionConfig(): InteractionConfig {
  return { ...config }
}

export function saveInteractionConfig(next: InteractionConfig): InteractionConfig {
  config = clampInteractionConfig(next)
  writeInteractionConfig(config)
  lastReminderAt = Date.now()
  lastIdleQuoteAt = Date.now()
  restartTimers()
  return config
}

export function setPetActivityState(state: PetActivityState): void {
  petState = state
  flushPendingReminder()
}

export function onPlayQuoteEvent(kind: PlayQuoteKind): void {
  if (config.playQuotesMuted)
    return
  if (kind === 'hover') {
    const now = Date.now()
    if (now - lastHoverQuoteAt < 4000)
      return
    lastHoverQuoteAt = now
  }
  const pool = kind === 'click' ? config.clickQuotes : config.hoverQuotes
  const line = pickRandomLine(pool)
  if (!line || !canShowBubble())
    return
  sendBubble(line, 6000)
}

export function pauseReminders30Minutes(): void {
  pauseRemindersUntil = Date.now() + REMINDER_PAUSE_MS
}

export function isPlayQuotesMuted(): boolean {
  return config.playQuotesMuted
}

export function setPlayQuotesMuted(muted: boolean): void {
  config = { ...config, playQuotesMuted: muted }
  writeInteractionConfig(config)
}

export function togglePlayQuotesMuted(): boolean {
  setPlayQuotesMuted(!config.playQuotesMuted)
  return config.playQuotesMuted
}

export function startInteractionService(): void {
  config = readInteractionConfig()
  lastReminderAt = Date.now()
  lastIdleQuoteAt = Date.now()
  restartTimers()
}

export function stopInteractionService(): void {
  if (reminderTimer)
    clearInterval(reminderTimer)
  if (idleTimer)
    clearInterval(idleTimer)
  reminderTimer = null
  idleTimer = null
}

export function registerInteractionIpc(): void {
  ipcMain.handle('interaction:getConfig', () => getInteractionConfig())
  ipcMain.handle('interaction:saveConfig', (_e, input: InteractionConfig) => saveInteractionConfig(input))
  ipcMain.on('interaction:setPetState', (_e, state: PetActivityState) => setPetActivityState(state))
  ipcMain.on('interaction:playEvent', (_e, kind: PlayQuoteKind) => onPlayQuoteEvent(kind))
}
