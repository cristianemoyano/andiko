/** Maps AFIP service error codes to user-facing message + HTTP status. */
export const AFIP_ERROR_MAP: Record<string, [string, number]> = {
  DOCUMENT_NOT_FOUND: ['Comprobante no encontrado', 404],
  AFIP_ORG_NOT_FOUND: ['Organización no encontrada', 404],
  AFIP_ALREADY_AUTHORIZED: ['El comprobante ya tiene CAE autorizado', 409],
  AFIP_DOCUMENT_NOT_ISSUED: ['El comprobante debe estar emitido antes de autorizarse en AFIP', 409],
  AFIP_CONTACT_REQUIRED: ['El comprobante requiere un cliente con datos fiscales', 422],
  AFIP_PUNTO_VENTA_REQUIRED: ['La sucursal no tiene punto de venta AFIP configurado', 422],
  AFIP_ISSUER_NOT_ELECTRONIC: ['La condición de IVA de la empresa no permite emitir comprobantes electrónicos', 422],
  AFIP_CERT_NOT_CONFIGURED: ['Falta configurar el certificado AFIP', 503],
  EMISSION_NOT_FOUND: ['Emisión no encontrada', 404],
  EMISSION_ALREADY_AUTHORIZED: ['La emisión ya fue autorizada', 409],
  BRANCH_NOT_FOUND: ['Sucursal no encontrada', 404],
}
