import { z } from 'zod'
import { ORG_IVA_CONDITIONS } from '@/modules/auth/organization.model'

/**
 * Platform issuer ("emisor") details — the fiscal identity of the platform that
 * appears on the subscription invoices billed to organizations. Stored on the
 * singleton `platform_settings` row, managed by sys-admin. No secrets here, so
 * the public view returns every field as-is.
 */

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')

export const billerSettingsUpdateSchema = z
  .object({
    legal_name:          z.string().max(255).nullable().optional(),
    cuit:                z.string().max(13).regex(/^\d{2}-?\d{8}-?\d$/, 'CUIT inválido').nullable().optional().or(z.literal('')),
    iva_condition:       z.enum(ORG_IVA_CONDITIONS).nullable().optional().or(z.literal('')),
    fiscal_address:      z.string().max(500).nullable().optional(),
    gross_income:        z.string().max(32).nullable().optional(),
    activity_start_date: dateOnly.nullable().optional().or(z.literal('')),
    email:               z.string().email('Email inválido').max(320).nullable().optional().or(z.literal('')),
    phone:               z.string().max(40).nullable().optional(),
  })
  .strict()
export type BillerSettingsUpdateInput = z.infer<typeof billerSettingsUpdateSchema>

/** Client-safe view of the platform issuer details. */
export interface PublicBillerSettings {
  legal_name: string | null
  cuit: string | null
  iva_condition: string | null
  fiscal_address: string | null
  gross_income: string | null
  activity_start_date: string | null
  email: string | null
  phone: string | null
}

export const DEFAULT_BILLER_SETTINGS: PublicBillerSettings = {
  legal_name: null,
  cuit: null,
  iva_condition: null,
  fiscal_address: null,
  gross_income: null,
  activity_start_date: null,
  email: null,
  phone: null,
}
