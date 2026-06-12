import { z } from 'zod'

/**
 * Per-organization print template configuration.
 *
 * Stored as a JSONB blob on `organization_settings.print_template`. The blob is
 * validated by `printTemplateSchema` on write and merged with `DEFAULT_PRINT_TEMPLATE`
 * on read, so an org without configuration always renders the historical default output.
 */

/** Whitelisted font families — keep in sync with `FONT_FAMILY_CSS`. */
export const PRINT_TEMPLATE_FONTS = ['sans', 'serif', 'mono'] as const
export type PrintTemplateFont = (typeof PRINT_TEMPLATE_FONTS)[number]

/** Toggleable document sections. */
export const PRINT_TEMPLATE_SECTIONS = [
  'logo',
  'fiscal_block',
  'branch',
  'counterparty',
  'notes',
  'footer',
] as const
export type PrintTemplateSection = (typeof PRINT_TEMPLATE_SECTIONS)[number]

/** `#rgb` or `#rrggbb`. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const hexColorSchema = z
  .string()
  .regex(HEX_COLOR, 'Color hexadecimal inválido (#rrggbb)')

/** Logo URL: http(s) absolute URL or a base64 image data-URL. */
const logoUrlSchema = z
  .string()
  .max(2_000_000, 'Logo demasiado grande')
  .refine(
    (v) => /^https?:\/\//.test(v) || /^data:image\/(png|jpe?g|svg\+xml|webp|gif);base64,/.test(v),
    'Debe ser una URL http(s) o una imagen embebida (data:image)',
  )

const sectionsShape = Object.fromEntries(
  PRINT_TEMPLATE_SECTIONS.map((s) => [s, z.boolean()]),
) as Record<PrintTemplateSection, z.ZodBoolean>

/** Full sections object — every toggle required (canonical, persisted shape). */
const sectionsSchema = z.object(sectionsShape).strict()
/** Partial sections object — used on update (org toggles a subset). */
const sectionsUpdateSchema = z.object(sectionsShape).partial().strict()

export const printTemplateSchema = z.object({
  logo_url: logoUrlSchema.nullable(),
  accent_color: hexColorSchema,
  /** Display toggles / overrides for the fiscal data block. */
  show_cuit: z.boolean(),
  show_iva_condition: z.boolean(),
  show_fiscal_address: z.boolean(),
  footer_text: z.string().max(500).nullable(),
  /** Stretch: visual editor. */
  font_family: z.enum(PRINT_TEMPLATE_FONTS),
  sections: sectionsSchema,
})

export type PrintTemplate = z.infer<typeof printTemplateSchema>

/** Partial update — every field optional; `sections` may be a subset. */
export const printTemplateUpdateSchema = printTemplateSchema.partial().extend({
  sections: sectionsUpdateSchema.optional(),
})
export type PrintTemplateUpdateInput = z.infer<typeof printTemplateUpdateSchema>

export const DEFAULT_PRINT_TEMPLATE: PrintTemplate = {
  logo_url: null,
  accent_color: '#18181b', // zinc-900 — matches the historical default header text color.
  show_cuit: true,
  show_iva_condition: true,
  show_fiscal_address: true,
  footer_text: null,
  font_family: 'sans',
  sections: {
    logo: true,
    fiscal_block: true,
    branch: true,
    counterparty: true,
    notes: true,
    footer: true,
  },
}

/** Tailwind/CSS font stacks per whitelisted family. */
export const FONT_FAMILY_CSS: Record<PrintTemplateFont, string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

/**
 * Merge a (possibly partial / persisted) blob over the defaults.
 * `sections` is merged key-by-key so a stored subset keeps default visibility
 * for any section the org never toggled.
 */
export function mergePrintTemplate(stored: unknown): PrintTemplate {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_PRINT_TEMPLATE }
  const parsed = printTemplateUpdateSchema.safeParse(stored)
  if (!parsed.success) return { ...DEFAULT_PRINT_TEMPLATE }
  const data = parsed.data
  return {
    ...DEFAULT_PRINT_TEMPLATE,
    ...data,
    sections: { ...DEFAULT_PRINT_TEMPLATE.sections, ...(data.sections ?? {}) },
  }
}
