import { NextResponse } from 'next/server'

/** Maps AFIP service error codes to user-facing message + HTTP status. */
export const AFIP_ERROR_MAP: Record<string, [string, number]> = {
  DOCUMENT_NOT_FOUND: ['Comprobante no encontrado', 404],
  AFIP_ORG_NOT_FOUND: ['Organización no encontrada', 404],
  AFIP_ALREADY_AUTHORIZED: ['El comprobante ya tiene CAE autorizado', 409],
  AFIP_DOCUMENT_NOT_ISSUED: ['El comprobante debe estar emitido antes de autorizarse en AFIP', 409],
  AFIP_CONTACT_REQUIRED: ['El comprobante requiere un cliente con datos fiscales', 422],
  AFIP_PUNTO_VENTA_REQUIRED: ['La sucursal no tiene punto de venta AFIP configurado', 422],
  AFIP_ISSUER_NOT_ELECTRONIC: [
    'Configurá la condición de IVA de tu empresa (emisor), no la del cliente, en Configuración → AFIP → Datos fiscales',
    422,
  ],
  AFIP_CERT_NOT_CONFIGURED: ['Falta configurar el certificado AFIP', 503],
  EMISSION_NOT_FOUND: ['Emisión no encontrada', 404],
  EMISSION_ALREADY_AUTHORIZED: ['La emisión ya fue autorizada', 409],
  BRANCH_NOT_FOUND: ['Sucursal no encontrada', 404],
  AFIP_INVALID_CERT: ['El certificado no es un PEM X.509 válido', 422],
  AFIP_INVALID_KEY: ['La clave privada no es un PEM válido', 422],
  AFIP_KEY_MISMATCH: ['La clave privada no corresponde al certificado', 422],
  POS_BRANCH_REQUIRED: ['El dispositivo POS no tiene sucursal asignada', 422],
  POS_SALE_FINALIZE_ERROR: [
    'El CAE se autorizó pero falló la facturación en el ERP. Reintentá desde el POS o contactá soporte.',
    500,
  ],
  AFIP_ORDER_ALREADY_INVOICED: [
    'Este pedido ya tiene otra factura con CAE autorizado. Abrí la factura existente o anulá el duplicado.',
    409,
  ],
  AFIP_CAE_REJECTED: ['AFIP rechazó la autorización del comprobante', 422],
  AFIP_CAE_TRANSPORT_ERROR: ['No se pudo contactar a AFIP. Reintentá más tarde.', 503],
  AFIP_CREDENTIAL_NOT_FOUND: ['No hay credenciales AFIP configuradas para ese entorno', 404],
}

export type AfipMappedError = {
  code: string
  message: string
  status: number
}

function errorCode(err: Error): string | null {
  const coded = err as Error & { code?: unknown }
  return typeof coded.code === 'string' ? coded.code : null
}

/** Resolves a thrown AFIP service error to HTTP fields, or null if unmapped. */
export function resolveAfipError(err: unknown): AfipMappedError | null {
  if (!(err instanceof Error)) return null

  const code = errorCode(err) ?? err.message
  if (!(code in AFIP_ERROR_MAP)) return null

  const [message, status] = AFIP_ERROR_MAP[code]
  return { code, message, status }
}

/** Returns a JSON error response for mapped AFIP errors; rethrows anything else. */
export function mapAfipErrorResponse(err: unknown): NextResponse {
  const mapped = resolveAfipError(err)
  if (!mapped) throw err
  const details =
    err instanceof Error && 'details' in err
      ? (err as Error & { details?: object }).details
      : undefined
  return NextResponse.json(
    { error: mapped.message, code: mapped.code, ...(details ? { details } : {}) },
    { status: mapped.status },
  )
}
