import 'server-only'
import Organization from '@/modules/auth/organization.model'
import type { PrintableIssuer, PrintableTemplate } from '@/types/printing'
import { getEffectivePrintTemplate } from './print-template.service'
import { FONT_FAMILY_CSS } from './print-template.schema'

export async function getIssuerName(orgId: string): Promise<string> {
  const org = await Organization.findByPk(orgId, { attributes: ['name'] })
  return org?.name ?? 'Organización'
}

/**
 * Resolves the issuer header block and the presentation template for printed
 * documents. Pulls the org's real fiscal columns and merges them with the
 * per-org print-template config (or defaults when none is configured).
 */
export async function getPrintHeader(
  orgId: string,
): Promise<{ issuer: PrintableIssuer; template: PrintableTemplate }> {
  const [name, eff] = await Promise.all([
    getIssuerName(orgId),
    getEffectivePrintTemplate(orgId),
  ])
  const { template: t, fiscal } = eff

  const issuer: PrintableIssuer = {
    name,
    legal_name: fiscal.legal_name,
    cuit: t.show_cuit ? fiscal.cuit : null,
    iva_condition_label: t.show_iva_condition ? fiscal.iva_condition_label : null,
    fiscal_address: t.show_fiscal_address ? fiscal.fiscal_address : null,
  }

  const template: PrintableTemplate = {
    logo_url: t.logo_url,
    accent_color: t.accent_color,
    font_css: FONT_FAMILY_CSS[t.font_family],
    footer_text: t.footer_text,
    sections: { ...t.sections },
    show_cuit: t.show_cuit,
    show_iva_condition: t.show_iva_condition,
    show_fiscal_address: t.show_fiscal_address,
  }

  return { issuer, template }
}
