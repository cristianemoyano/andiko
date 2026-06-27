/** Human-readable seat capacity for previews and invoice adjustment lines. */
export function formatSeatCapacitySummary(input: {
  active: number
  contracted: number
  includedInPlan: number
}): string {
  const { active, contracted, includedInPlan } = input
  const parts: string[] = [`${active} activos`]

  if (contracted > active) {
    if (contracted > includedInPlan) {
      parts.push(`${contracted} mínimo en contrato`, `${includedInPlan} incluidos en plan`)
    } else if (contracted === includedInPlan) {
      parts.push(`mínimo ${contracted} en contrato (incluidos en plan)`)
    } else {
      parts.push(`${contracted} mínimo en contrato`, `${includedInPlan} incluidos en plan`)
    }
  } else {
    parts.push(`${includedInPlan} incluidos en plan`)
  }

  return parts.join(' · ')
}
