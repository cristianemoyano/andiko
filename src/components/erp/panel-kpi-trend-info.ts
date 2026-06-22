/** Appends panel trend (% pill / sparkline color) explanation to a KPI tooltip. */
export function withPanelTrendInfo(metricInfo: string, comparePeriodLabel?: string): string {
  const compare = comparePeriodLabel?.trim()
  const periodText = compare
    ? compare.replace(/^Comparado con\s+/i, '')
    : 'el período anterior de igual duración'

  return [
    metricInfo,
    '',
    'Variación (% verde o rojo): compara el período seleccionado con',
    periodText + '.',
    'Verde = subió; rojo = bajó.',
    'Sin badge = sin cambio o sin datos en el período de referencia.',
    'La línea debajo muestra la evolución dentro del período actual.',
  ].join('\n')
}

export function panelTrendPillTooltip(pct: number, comparePeriodLabel?: string): string {
  const compare = comparePeriodLabel?.trim()
  const periodText = compare
    ? compare.replace(/^Comparado con\s+/i, '')
    : 'el período anterior de igual duración'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct} % respecto a ${periodText}.`
}
