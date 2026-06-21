/** Display ticket number for thermal printers: `{PV 4d}-{cbte 8d}`. */
export function formatFiscalTicketNumber(puntoVenta: number, cbteNumero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(cbteNumero).padStart(8, '0')}`
}
