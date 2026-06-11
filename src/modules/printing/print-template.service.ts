import 'server-only'
import { cache } from 'react'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import Organization, { type OrgIvaCondition } from '@/modules/auth/organization.model'
import {
  DEFAULT_PRINT_TEMPLATE,
  mergePrintTemplate,
  printTemplateSchema,
  type PrintTemplate,
  type PrintTemplateUpdateInput,
} from './print-template.schema'

export const ORG_IVA_CONDITION_LABEL: Record<OrgIvaCondition, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributista: 'Monotributista',
  consumidor_final: 'Consumidor Final',
  exento: 'Exento',
  no_responsable: 'No Responsable',
}

/** Org's real fiscal data, used by the template to populate the fiscal block. */
export interface OrgFiscalData {
  legal_name: string | null
  cuit: string | null
  iva_condition: OrgIvaCondition | null
  iva_condition_label: string | null
  fiscal_address: string | null
}

export interface EffectivePrintTemplate {
  org_id: string
  /** Merged config (defaults + stored overrides). */
  template: PrintTemplate
  /** Org fiscal columns, for the fiscal block. */
  fiscal: OrgFiscalData
  /** true when the org has no stored template and the defaults apply. */
  is_default: boolean
}

function fiscalFromOrg(org: Organization): OrgFiscalData {
  return {
    legal_name: org.legal_name,
    cuit: org.cuit,
    iva_condition: org.iva_condition,
    iva_condition_label: org.iva_condition ? ORG_IVA_CONDITION_LABEL[org.iva_condition] : null,
    fiscal_address: org.fiscal_address,
  }
}

async function loadEffectivePrintTemplate(orgId: string): Promise<EffectivePrintTemplate> {
  const [org, row] = await Promise.all([
    Organization.findByPk(orgId, {
      attributes: ['id', 'legal_name', 'cuit', 'iva_condition', 'fiscal_address'],
    }),
    OrganizationSetting.findOne({ where: { org_id: orgId }, attributes: ['print_template'] }),
  ])
  if (!org) throw new Error('ORG_NOT_FOUND')

  const stored = row?.print_template ?? null
  return {
    org_id: orgId,
    template: stored ? mergePrintTemplate(stored) : { ...DEFAULT_PRINT_TEMPLATE },
    fiscal: fiscalFromOrg(org),
    is_default: !stored,
  }
}

/** Deduplicated per request via React cache() — safe to call from print adapters and routes. */
export const getEffectivePrintTemplate = cache(loadEffectivePrintTemplate)

/**
 * Persist a partial template update. Merges the incoming patch over the org's
 * current effective template, validates the full result, then stores it.
 */
export async function updatePrintTemplate(
  orgId: string,
  input: PrintTemplateUpdateInput,
): Promise<EffectivePrintTemplate> {
  const org = await Organization.findByPk(orgId)
  if (!org) throw new Error('ORG_NOT_FOUND')

  const current = await loadEffectivePrintTemplate(orgId)
  const next: PrintTemplate = printTemplateSchema.parse({
    ...current.template,
    ...input,
    sections: { ...current.template.sections, ...(input.sections ?? {}) },
  })

  const existing = await OrganizationSetting.findOne({ where: { org_id: orgId } })
  if (existing) {
    await existing.update({ print_template: next })
  } else {
    await OrganizationSetting.create({ org_id: orgId, print_template: next })
  }

  return {
    org_id: orgId,
    template: next,
    fiscal: fiscalFromOrg(org),
    is_default: false,
  }
}
