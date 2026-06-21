import 'server-only'
import User from './user.model'
import {
  isPanelWidgetId,
  normalizePanelWidgetOrder,
  type PanelWidgetId,
} from '@/modules/panel/panel-widget.types'

export interface UserPreferences {
  panel?: {
    hidden_widgets?: PanelWidgetId[]
    widget_order?: PanelWidgetId[]
  }
}

function normalizePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object') return {}
  const root = raw as Record<string, unknown>
  const panel = root.panel
  if (!panel || typeof panel !== 'object') return {}

  const panelRecord = panel as Record<string, unknown>
  const hidden = panelRecord.hidden_widgets
  const order = panelRecord.widget_order

  const result: UserPreferences = { panel: {} }

  if (Array.isArray(hidden)) {
    result.panel!.hidden_widgets = hidden.filter(isPanelWidgetId)
  }
  if (Array.isArray(order)) {
    result.panel!.widget_order = order.filter(isPanelWidgetId)
  }

  if (!result.panel!.hidden_widgets && !result.panel!.widget_order) return {}
  return result
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const user = await User.findByPk(userId, { attributes: ['preferences'] })
  return normalizePreferences(user?.preferences ?? {})
}

export async function updateUserPreferences(
  userId: string,
  patch: UserPreferences,
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId)
  const merged: UserPreferences = {
    ...current,
    ...patch,
    panel: {
      ...current.panel,
      ...patch.panel,
    },
  }

  await User.update(
    { preferences: merged as Record<string, unknown> },
    { where: { id: userId } },
  )

  return merged
}

export function getPanelHiddenWidgets(preferences: UserPreferences): PanelWidgetId[] {
  return preferences.panel?.hidden_widgets ?? []
}

export function getPanelWidgetOrder(preferences: UserPreferences): PanelWidgetId[] {
  return normalizePanelWidgetOrder(preferences.panel?.widget_order)
}
