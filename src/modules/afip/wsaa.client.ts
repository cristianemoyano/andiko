/**
 * WSAA (authentication) transport boundary.
 *
 * Services depend only on the `WsaaClient` interface. The real implementation
 * (`arca-clients.ts`) wraps `@ramiidv/arca-facturacion`; `StubWsaaClient` is used
 * for tests and `AFIP_MODE=stub` local dev — it needs no certificate or network.
 */

export type AfipAuthTicket = {
  token: string
  sign: string
  expiresAt: Date
}

export interface WsaaClient {
  /** Returns a valid access ticket (TA) for the given AFIP service (e.g. `wsfe`). */
  authenticate(service: string): Promise<AfipAuthTicket>
}

export class StubWsaaClient implements WsaaClient {
  async authenticate(service: string): Promise<AfipAuthTicket> {
    return {
      token: `stub-token-${service}`,
      sign: 'stub-sign',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    }
  }
}
