import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: {},
}))

vi.mock('./user.model', () => ({
  default: {
    findByPk: vi.fn(),
    update: vi.fn(),
  },
}))

import User from './user.model'
import { getUserPreferences, updateUserPreferences, getPanelHiddenWidgets, getPanelWidgetOrder } from './user-preferences.service'

beforeEach(() => vi.clearAllMocks())

describe('user-preferences.service', () => {
  it('returns normalized panel hidden widgets', async () => {
    vi.mocked(User.findByPk).mockResolvedValueOnce({
      preferences: { panel: { hidden_widgets: ['performance', 'invalid', 'activity'] } },
    } as never)

    const prefs = await getUserPreferences('user-1')
    expect(getPanelHiddenWidgets(prefs)).toEqual(['performance', 'activity'])
  })

  it('returns normalized panel widget order', async () => {
    vi.mocked(User.findByPk).mockResolvedValueOnce({
      preferences: { panel: { widget_order: ['activity', 'performance', 'invalid'] } },
    } as never)

    const prefs = await getUserPreferences('user-1')
    expect(getPanelWidgetOrder(prefs).slice(0, 2)).toEqual(['activity', 'performance'])
  })

  it('merges panel preferences on update', async () => {
    vi.mocked(User.findByPk).mockResolvedValueOnce({
      preferences: { panel: { hidden_widgets: ['performance'], widget_order: ['performance', 'activity'] } },
    } as never)
    vi.mocked(User.update).mockResolvedValueOnce([1] as never)

    const result = await updateUserPreferences('user-1', {
      panel: { hidden_widgets: ['activity'] },
    })

    expect(User.update).toHaveBeenCalledWith(
      {
        preferences: {
          panel: {
            hidden_widgets: ['activity'],
            widget_order: ['performance', 'activity'],
          },
        },
      },
      { where: { id: 'user-1' } },
    )
    expect(getPanelHiddenWidgets(result)).toEqual(['activity'])
  })
})
