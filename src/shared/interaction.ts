export type PlayQuoteKind = 'click' | 'hover'

export interface InteractionConfig {
  reminderEnabled: boolean
  /** 提醒间隔（分钟） */
  reminderIntervalMinutes: number
  reminderMessages: string[]
  /** 静音玩耍台词（不影响提醒） */
  playQuotesMuted: boolean
  clickQuotes: string[]
  hoverQuotes: string[]
  idleQuotesEnabled: boolean
  /** 空闲台词间隔（分钟），默认较长 */
  idleIntervalMinutes: number
  idleQuotes: string[]
}

export interface BubblePayload {
  text: string
  durationMs: number
}

export const BUBBLE_BAR_HEIGHT = 56
export const DEFAULT_BUBBLE_DURATION_MS = 8000

export const DEFAULT_INTERACTION: InteractionConfig = {
  reminderEnabled: false,
  reminderIntervalMinutes: 45,
  reminderMessages: [
    '起来动一动～',
    '喝口水吧',
    '眼睛休息一下',
  ],
  playQuotesMuted: false,
  clickQuotes: [
    '干嘛戳我！',
    '嘿嘿～',
    '再戳一下试试？',
  ],
  hoverQuotes: [
    '你在看我吗',
    '好痒…',
  ],
  idleQuotesEnabled: false,
  idleIntervalMinutes: 30,
  idleQuotes: [
    '还在忙吗？',
    '我在这儿陪着你',
  ],
}

export function pickRandomLine(lines: string[]): string | null {
  const pool = lines.map(s => s.trim()).filter(Boolean)
  if (!pool.length)
    return null
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}
