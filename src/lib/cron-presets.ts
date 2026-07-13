/** Shared cron presets for automation UIs (tenant + sys-admin). Client-safe. */

export const CRON_PRESET_CUSTOM = 'custom'

export interface CronPreset {
  id: string
  label: string
  /** 5-field cron; empty when id is custom. */
  expression: string
  help: string
}

export const CRON_PRESETS: readonly CronPreset[] = [
  {
    id: 'daily-6',
    label: 'Diario a las 06:00',
    expression: '0 6 * * *',
    help: 'Todos los días a las 06:00',
  },
  {
    id: 'daily-0',
    label: 'Diario a las 00:00',
    expression: '0 0 * * *',
    help: 'Todos los días a medianoche',
  },
  {
    id: 'hourly',
    label: 'Cada hora',
    expression: '0 * * * *',
    help: 'Al inicio de cada hora',
  },
  {
    id: 'weekly-mon-8',
    label: 'Lunes a las 08:00',
    expression: '0 8 * * 1',
    help: 'Todos los lunes a las 08:00',
  },
  {
    id: 'monthly-1-6',
    label: 'Día 1 del mes a las 06:00',
    expression: '0 6 1 * *',
    help: 'El primer día de cada mes a las 06:00',
  },
  {
    id: CRON_PRESET_CUSTOM,
    label: 'Personalizado',
    expression: '',
    help: 'Expresión cron de 5 campos (min hora día mes día-semana)',
  },
] as const

export const DEFAULT_CRON_PRESET_ID = 'daily-6'
export const DEFAULT_CRON_EXPRESSION = '0 6 * * *'
export const DEFAULT_CRON_TIMEZONE = 'America/Argentina/Buenos_Aires'

/** Resolve which preset matches a stored expression (exact match on known presets). */
export function matchCronPresetId(expression: string): string {
  const trimmed = expression.trim()
  const found = CRON_PRESETS.find(p => p.id !== CRON_PRESET_CUSTOM && p.expression === trimmed)
  return found?.id ?? CRON_PRESET_CUSTOM
}

/** Human-readable help for a preset id or a raw expression. */
export function cronHelpText(presetId: string, expression: string): string {
  if (presetId !== CRON_PRESET_CUSTOM) {
    const preset = CRON_PRESETS.find(p => p.id === presetId)
    if (preset) return preset.help
  }
  const trimmed = expression.trim()
  if (!trimmed) return 'Ingresá una expresión cron de 5 campos'
  const matched = CRON_PRESETS.find(p => p.id !== CRON_PRESET_CUSTOM && p.expression === trimmed)
  if (matched) return matched.help
  return `Cron: ${trimmed}`
}

export function cronPresetSelectOptions(): Array<{ value: string; label: string }> {
  return CRON_PRESETS.map(p => ({ value: p.id, label: p.label }))
}
