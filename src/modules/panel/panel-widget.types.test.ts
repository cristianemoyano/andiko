import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PANEL_WIDGET_ORDER,
  normalizePanelWidgetOrder,
  parseHiddenPanelWidgets,
  isPanelWidgetId,
} from './panel-widget.types'

describe('panel-widget.types', () => {
  it('parses valid hidden widget ids from JSON', () => {
    expect(parseHiddenPanelWidgets(JSON.stringify(['performance', 'activity', 'invalid']))).toEqual([
      'performance',
      'activity',
    ])
  })

  it('returns empty array for invalid storage', () => {
    expect(parseHiddenPanelWidgets(null)).toEqual([])
    expect(parseHiddenPanelWidgets('not-json')).toEqual([])
    expect(parseHiddenPanelWidgets('{"foo":1}')).toEqual([])
  })

  it('validates widget ids', () => {
    expect(isPanelWidgetId('performance')).toBe(true)
    expect(isPanelWidgetId('unknown')).toBe(false)
  })

  it('normalizes widget order with defaults for missing ids', () => {
    expect(normalizePanelWidgetOrder(['activity', 'performance'])).toEqual([
      'activity',
      'performance',
      ...DEFAULT_PANEL_WIDGET_ORDER.filter(id => id !== 'activity' && id !== 'performance'),
    ])
  })

  it('returns default order for invalid input', () => {
    expect(normalizePanelWidgetOrder(null)).toEqual(DEFAULT_PANEL_WIDGET_ORDER)
    expect(normalizePanelWidgetOrder(['invalid'])).toEqual(DEFAULT_PANEL_WIDGET_ORDER)
  })
})
