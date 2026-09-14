import type { InteractionConfig } from '@shared/interaction'
import type { PetState } from '@shared/pet'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_INTERACTION } from '@shared/interaction'
import { app } from 'electron'

function configPath(): string {
  return path.join(app.getPath('userData'), 'interaction.json')
}

export function readInteractionConfig(): InteractionConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8')) as Partial<InteractionConfig>
    return {
      ...DEFAULT_INTERACTION,
      ...raw,
      reminderMessages: raw.reminderMessages?.length ? raw.reminderMessages : DEFAULT_INTERACTION.reminderMessages,
      clickQuotes: raw.clickQuotes?.length ? raw.clickQuotes : DEFAULT_INTERACTION.clickQuotes,
      hoverQuotes: raw.hoverQuotes?.length ? raw.hoverQuotes : DEFAULT_INTERACTION.hoverQuotes,
      idleQuotes: raw.idleQuotes?.length ? raw.idleQuotes : DEFAULT_INTERACTION.idleQuotes,
    }
  }
  catch {
    return { ...DEFAULT_INTERACTION }
  }
}

export function writeInteractionConfig(config: InteractionConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2))
}

export function clampInteractionConfig(input: InteractionConfig): InteractionConfig {
  return {
    ...input,
    reminderIntervalMinutes: Math.min(240, Math.max(5, Math.round(input.reminderIntervalMinutes))),
    idleIntervalMinutes: Math.min(240, Math.max(10, Math.round(input.idleIntervalMinutes))),
    reminderMessages: input.reminderMessages.map(s => s.trim()).filter(Boolean),
    clickQuotes: input.clickQuotes.map(s => s.trim()).filter(Boolean),
    hoverQuotes: input.hoverQuotes.map(s => s.trim()).filter(Boolean),
    idleQuotes: input.idleQuotes.map(s => s.trim()).filter(Boolean),
  }
}

export type PetActivityState = PetState
