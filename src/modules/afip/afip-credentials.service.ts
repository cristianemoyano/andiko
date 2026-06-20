import 'server-only'
import { X509Certificate, createPrivateKey } from 'node:crypto'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import type { TenantContext } from '@/lib/tenancy'
import AfipCredential, { type AfipCredentialEnvironment } from './afip-credential.model'

export type UploadCredentialsInput = {
  environment: AfipCredentialEnvironment
  cuit: string
  cert: string
  key: string
  label?: string
}

/** Redacted, client-safe view of a stored credential. Never includes cert/key. */
export type CredentialStatus = {
  environment: AfipCredentialEnvironment
  cuit: string
  label: string | null
  expires_at: Date | null
  is_active: boolean
}

/** Server-only resolved credential for the transport adapter. */
export type ResolvedAfipCredentials = {
  cuit: string
  cert: string
  key: string
  production: boolean
}

/**
 * Validates and stores an organization's ARCA certificate + private key for an
 * environment. The certificate is parsed to extract its expiration and to verify
 * the private key matches it; the key is encrypted at rest. The previously active
 * credential for the same (org, environment) is deactivated (never overwritten).
 */
export async function uploadCredentials(orgId: string, input: UploadCredentialsInput, actorId: string) {
  const cert = input.cert.trim()
  const key = input.key.trim()

  let x509: X509Certificate
  try {
    x509 = new X509Certificate(cert)
  } catch {
    throw new Error('AFIP_INVALID_CERT')
  }

  try {
    const keyObj = createPrivateKey(key)
    if (!x509.checkPrivateKey(keyObj)) throw new Error('AFIP_KEY_MISMATCH')
  } catch (err) {
    if (err instanceof Error && err.message === 'AFIP_KEY_MISMATCH') throw err
    throw new Error('AFIP_INVALID_KEY')
  }

  const expires_at = x509.validTo ? new Date(x509.validTo) : null

  return sequelize.transaction(async (t) => {
    await AfipCredential.update(
      { is_active: false, updated_by: actorId },
      { where: { org_id: orgId, environment: input.environment, is_active: true }, transaction: t },
    )

    const credential = await AfipCredential.create(
      {
        org_id: orgId,
        environment: input.environment,
        cuit: input.cuit,
        cert_pem: cert,
        key_encrypted: encryptSecret(key),
        label: input.label ?? null,
        expires_at: Number.isNaN(expires_at?.getTime()) ? null : expires_at,
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    logger.info({ orgId, environment: input.environment, credentialId: credential.id }, 'afip credentials uploaded')
    return toStatus(credential)
  })
}

/** Per-environment credential status for the org (no secrets). */
export async function getCredentialStatus(ctx: TenantContext): Promise<CredentialStatus[]> {
  const rows = await AfipCredential.findAll({
    where: { org_id: ctx.orgId, is_active: true },
    order: [['environment', 'ASC']],
  })
  return rows.map(toStatus)
}

/** Server-only: decrypts the key for the transport adapter. Returns null if unset. */
export async function getResolvedCredentials(
  orgId: string,
  environment: AfipCredentialEnvironment,
): Promise<ResolvedAfipCredentials | null> {
  const row = await AfipCredential.findOne({ where: { org_id: orgId, environment, is_active: true } })
  if (!row) return null
  const key = decryptSecret(row.key_encrypted)
  if (!key) {
    logger.error({ orgId, environment }, 'afip credential key failed to decrypt')
    return null
  }
  return { cuit: row.cuit, cert: row.cert_pem, key, production: environment === 'produccion' }
}

export async function deleteCredentials(
  orgId: string,
  environment: AfipCredentialEnvironment,
  actorId: string,
) {
  const row = await AfipCredential.findOne({ where: { org_id: orgId, environment, is_active: true } })
  if (!row) throw new Error('AFIP_CREDENTIAL_NOT_FOUND')
  await row.update({ is_active: false, deleted_by: actorId })
  await row.destroy()
  logger.info({ orgId, environment }, 'afip credentials removed')
}

function toStatus(row: AfipCredential): CredentialStatus {
  return {
    environment: row.environment,
    cuit: row.cuit,
    label: row.label,
    expires_at: row.expires_at,
    is_active: row.is_active,
  }
}
