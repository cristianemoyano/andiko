import { describe, expect, it } from 'vitest'
import {
  CRON_PRESET_CUSTOM,
  cronHelpText,
  matchCronPresetId,
} from '@/lib/cron-presets'

describe('cron-presets', () => {
  it('matches known preset expressions', () => {
    expect(matchCronPresetId('0 6 * * *')).toBe('daily-6')
    expect(matchCronPresetId('0 * * * *')).toBe('hourly')
  })

  it('falls back to custom for unknown expressions', () => {
    expect(matchCronPresetId('15 3 * * 2')).toBe(CRON_PRESET_CUSTOM)
  })

  it('returns Spanish help for presets', () => {
    expect(cronHelpText('daily-6', '0 6 * * *')).toContain('06:00')
    expect(cronHelpText(CRON_PRESET_CUSTOM, '15 3 * * 2')).toContain('15 3 * * 2')
  })
})
