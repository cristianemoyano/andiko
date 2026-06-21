import { z } from 'zod'
import { isPanelWidgetId } from '@/modules/panel/panel-widget.types'

const panelWidgetIdSchema = z.string().refine(isPanelWidgetId, { message: 'Invalid panel widget id' })

export const userPreferencesPatchSchema = z.object({
  panel: z.object({
    hidden_widgets: z.array(panelWidgetIdSchema).optional(),
    widget_order: z.array(panelWidgetIdSchema).optional(),
  }).optional(),
}).strict()

export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>
