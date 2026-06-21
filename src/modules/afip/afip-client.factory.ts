import 'server-only'
import { env } from '@/config/env'
import { StubWsaaClient, type WsaaClient } from './wsaa.client'
import { StubWsfeClient, type WsfeClient } from './wsfe.client'
import { getResolvedCredentials } from './afip-credentials.service'
import type { AfipCredentialEnvironment } from './afip-credential.model'

export type AfipClients = {
  wsaa: WsaaClient
  wsfe: WsfeClient
}

/**
 * Resolves the AFIP transport pair for an organization.
 *  - `stub` (default): deterministic in-memory clients, no cert/network.
 *  - `homologacion` / `produccion`: loads the org's stored ARCA credentials and
 *    builds the real `@ramiidv/arca-facturacion`-backed client. The SDK module
 *    is lazily imported so it is never bundled or loaded in stub mode / tests.
 */
export async function getAfipClients(orgId: string): Promise<AfipClients> {
  if (env.AFIP_MODE === 'stub') {
    return { wsaa: new StubWsaaClient(), wsfe: new StubWsfeClient() }
  }

  const environment = env.AFIP_MODE as AfipCredentialEnvironment
  const creds = await getResolvedCredentials(orgId, environment)
  if (!creds) throw new Error('AFIP_CERT_NOT_CONFIGURED')

  const { ArcaWsfeClient } = await import('./arca-clients')
  return { wsaa: new StubWsaaClient(), wsfe: new ArcaWsfeClient(creds) }
}
