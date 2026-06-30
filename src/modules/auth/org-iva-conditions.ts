/** AFIP-aligned IVA conditions for organizations (issuer). Shared by API, UI, and printing. */
export const ORG_IVA_CONDITIONS = [
  'responsable_inscripto',
  'monotributista',
  'consumidor_final',
  'exento',
  'no_responsable',
] as const

export type OrgIvaCondition = (typeof ORG_IVA_CONDITIONS)[number]

/** Labels match AFIP FEParamGetCondicionIvaReceptor descriptions where applicable. */
export const ORG_IVA_CONDITION_LABEL: Record<OrgIvaCondition, string> = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributista: 'Responsable Monotributo',
  consumidor_final: 'Consumidor Final',
  exento: 'IVA Sujeto Exento',
  no_responsable: 'Sujeto No Categorizado',
}

export const ORG_IVA_CONDITION_OPTIONS = ORG_IVA_CONDITIONS.map((value) => ({
  value,
  label: ORG_IVA_CONDITION_LABEL[value],
}))

/** Shown on org fiscal forms — S.R.L./S.A. are legal forms, not IVA conditions. */
export const ORG_IVA_CONDITION_HINT =
  'Las sociedades (S.R.L., S.A., etc.) inscriptas en IVA deben seleccionar IVA Responsable Inscripto. El tipo societario va en la razón social.'
