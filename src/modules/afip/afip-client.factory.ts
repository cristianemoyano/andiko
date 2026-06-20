import 'server-only'
import { env } from '@/config/env'
import { StubWsaaClient, type WsaaClient } from './wsaa.client'
import { StubWsfeClient, type WsfeClient } from './wsfe.client'

export type AfipClients = {
  wsaa: WsaaClient
  wsfe: WsfeClient
}

/**
 * Resolves the AFIP transport pair for the current `AFIP_MODE`.
 *  - `stub` (default): deterministic in-memory clients, no cert/network.
 *  - `homologacion` / `produccion`: real `@ramiidv/arca-facturacion`-backed clients,
 *    lazily imported so the SDK is never bundled or loaded in stub mode / tests.
 */
export async function getAfipClients(): Promise<AfipClients> {
  if (env.AFIP_MODE === 'stub') {
    return { wsaa: new StubWsaaClient(), wsfe: new StubWsfeClient() }
  }
  const { ArcaWsfeClient } = await import('./arca-clients')
  return { wsaa: new StubWsaaClient(), wsfe: new ArcaWsfeClient() }
}
