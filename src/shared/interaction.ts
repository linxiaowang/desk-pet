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

export type BubbleKind = 'click' | 'hover' | 'idle' | 'reminder'

export interface BubblePayload {
  text: string
  kind: BubbleKind
  /** 覆盖默认展示时长（不含进出场动画） */
  durationMs?: number
}

export const BUBBLE_BAR_HEIGHT = 72

/** 进 / 出场 CSS 动画约 220ms，逻辑里单独计算 */
export const BUBBLE_ANIM_MS = 220

export const BUBBLE_TIMING: Record<BubbleKind, { showDelay: number, visible: number, minVisible: number }> = {
  click: { showDelay: 140, visible: 4200, minVisible: 1300 },
  hover: { showDelay: 0, visible: 3400, minVisible: 1000 },
  idle: { showDelay: 220, visible: 5200, minVisible: 1800 },
  reminder: { showDelay: 280, visible: 9200, minVisible: 2800 },
}

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
