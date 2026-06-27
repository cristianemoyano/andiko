import 'server-only'
import PlatformSetting from '@/modules/auth/platform-setting.model'
import { formatDateOnly } from '@/lib/date-only'
import {
  type BillerSettingsUpdateInput,
  type PublicBillerSettings,
} from './platform-billing-settings.schema'

/**
 * Platform issuer ("emisor") fiscal details, managed by sys-admin and stored on
 * the singleton `platform_settings` row. These are surfaced as the issuer on
 * the subscription invoices billed to organizations.
 */

/** Load the singleton row, creating it on first access. */
async function getRow(): Promise<PlatformSetting> {
  const existing = await PlatformSetting.findOne({ where: { singleton: true } })
  if (existing) return existing
  return PlatformSetting.create({ singleton: true })
}

function toPublic(row: PlatformSetting): PublicBillerSettings {
  return {
    legal_name:          row.biller_legal_name,
    cuit:                row.biller_cuit,
    iva_condition:       row.biller_iva_condition,
    fiscal_address:      row.biller_fiscal_address,
    gross_income:        row.biller_gross_income,
    activity_start_date: formatDateOnly(row.biller_activity_start_date),
    email:               row.biller_email,
    phone:               row.biller_phone,
  }
}

/** Client-safe view of the platform issuer details. */
export async function getBillerSettings(): Promise<PublicBillerSettings> {
  return toPublic(await getRow())
}

/**
 * Resolved issuer details for invoice rendering. Returns null when the platform
 * issuer has not been configured (no legal name + CUIT yet), so callers can
 * decide how to handle an unconfigured issuer. Server-only.
 */
export async function getResolvedBillerSettings(): Promise<PublicBillerSettings | null> {
  const row = await getRow()
  if (!row.biller_legal_name || !row.biller_cuit) return null
  return toPublic(row)
}

/** `''` → null, so empty form fields clear the stored value. */
function blankToNull(value: string | null | undefined, current: string | null): string | null {
  if (value === undefined) return current
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Persist a partial issuer update onto the singleton row; returns the public view. */
export async function updateBillerSettings(
  input: BillerSettingsUpdateInput,
): Promise<PublicBillerSettings> {
  const row = await getRow()

  await row.update({
    biller_legal_name:          blankToNull(input.legal_name, row.biller_legal_name),
    biller_cuit:                blankToNull(input.cuit, row.biller_cuit),
    biller_iva_condition:       blankToNull(input.iva_condition, row.biller_iva_condition),
    biller_fiscal_address:      blankToNull(input.fiscal_address, row.biller_fiscal_address),
    biller_gross_income:        blankToNull(input.gross_income, row.biller_gross_income),
    biller_activity_start_date: blankToNull(input.activity_start_date, formatDateOnly(row.biller_activity_start_date)),
    biller_email:               blankToNull(input.email, row.biller_email),
    biller_phone:               blankToNull(input.phone, row.biller_phone),
  })

  return toPublic(row)
}
