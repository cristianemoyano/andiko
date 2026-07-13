'use client'

import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import {
  CRON_PRESETS,
  CRON_PRESET_CUSTOM,
  cronHelpText,
  cronPresetSelectOptions,
  matchCronPresetId,
} from '@/lib/cron-presets'

export interface CronScheduleFieldsProps {
  cronExpression: string
  timezone: string
  onCronExpressionChange: (value: string) => void
  onTimezoneChange: (value: string) => void
  /** Controlled preset id; when omitted, derived from expression. */
  presetId?: string
  onPresetIdChange?: (presetId: string) => void
  cronError?: string
  timezoneError?: string
  cronId?: string
  timezoneId?: string
}

/**
 * Friendly cron schedule controls: preset select + optional custom expression + timezone.
 * Parent owns state; when the user picks a preset, the parent should set the matching expression.
 */
export function CronScheduleFields({
  cronExpression,
  timezone,
  onCronExpressionChange,
  onTimezoneChange,
  presetId: presetIdProp,
  onPresetIdChange,
  cronError,
  timezoneError,
  cronId = 'cron_expression',
  timezoneId = 'timezone',
}: CronScheduleFieldsProps) {
  const presetId = presetIdProp ?? matchCronPresetId(cronExpression)
  const isCustom = presetId === CRON_PRESET_CUSTOM

  function handlePresetChange(next: string) {
    onPresetIdChange?.(next)
    if (next === CRON_PRESET_CUSTOM) return
    const preset = CRON_PRESETS.find(p => p.id === next)
    if (preset?.expression) onCronExpressionChange(preset.expression)
  }

  return (
    <div className="flex flex-col gap-3">
      <FormField label="Frecuencia" htmlFor={`${cronId}_preset`} required error={isCustom ? undefined : cronError}>
        <Select
          id={`${cronId}_preset`}
          value={presetId}
          onChange={handlePresetChange}
          options={cronPresetSelectOptions()}
        />
        <p className="text-xs text-fg-subtle mt-1">{cronHelpText(presetId, cronExpression)}</p>
      </FormField>
      {isCustom && (
        <FormField label="Expresión cron" htmlFor={cronId} required error={cronError}>
          <Input
            id={cronId}
            value={cronExpression}
            onChange={e => onCronExpressionChange(e.target.value)}
            placeholder="0 6 * * *"
            className="font-mono"
          />
        </FormField>
      )}
      <FormField label="Zona horaria" htmlFor={timezoneId} error={timezoneError}>
        <Input
          id={timezoneId}
          value={timezone}
          onChange={e => onTimezoneChange(e.target.value)}
          placeholder="America/Argentina/Buenos_Aires"
        />
      </FormField>
    </div>
  )
}
