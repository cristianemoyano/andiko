import { DOC_TIPO, type DocTipo } from './afip-codes'

export type DocReceiver = {
  cuit: string | null
}

export type ResolvedDoc = {
  docTipo: DocTipo
  docNro: number
}

/**
 * Resolves the AFIP receiver document (DocTipo + DocNro) for a contact.
 *
 * A valid 11-digit CUIT → DocTipo 80. Otherwise the receiver is treated as
 * Consumidor Final (DocTipo 99, DocNro 0), which AFIP only accepts on B/C
 * comprobantes — the caller is responsible for the letter/amount rules.
 */
export function resolveDocTipo(receiver: DocReceiver): ResolvedDoc {
  const digits = (receiver.cuit ?? '').replace(/\D/g, '')
  if (digits.length === 11) {
    return { docTipo: DOC_TIPO.CUIT, docNro: Number(digits) }
  }
  return { docTipo: DOC_TIPO.CONSUMIDOR_FINAL, docNro: 0 }
}
