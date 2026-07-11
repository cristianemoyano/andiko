import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIPv4, isIPv6 } from 'node:net'

function ip4ToInt(addr: string): number {
  return addr.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

const IPV4_PRIVATE_RANGES: Array<[string, string]> = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  // Includes the cloud metadata endpoint 169.254.169.254.
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
]

function isPrivateIPv4(ip: string): boolean {
  const value = ip4ToInt(ip)
  return IPV4_PRIVATE_RANGES.some(([start, end]) => value >= ip4ToInt(start) && value <= ip4ToInt(end))
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // fc00::/7 unique local
  if (['fe8', 'fe9', 'fea', 'feb'].some(prefix => normalized.startsWith(prefix))) return true // fe80::/10 link-local
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

/** Loopback, private (RFC1918), and link-local (incl. cloud metadata 169.254.169.254) addresses. */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIPv4(ip)
  if (isIPv6(ip)) return isPrivateIPv6(ip)
  return true // unrecognized format: fail closed
}

/**
 * Resolves `url`'s hostname and throws if it points at a private/loopback/link-local
 * address, or uses a non-HTTP(S) scheme. Guards outbound webhook-style automation
 * actions against SSRF (including simple DNS-rebinding via the resolved-IP check).
 */
export async function assertPublicHttpTarget(url: string): Promise<void> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Esquema de URL no permitido: ${parsed.protocol}`)
  }
  const { address } = await lookup(parsed.hostname)
  if (isPrivateOrLoopbackIp(address)) {
    throw new Error(`No se permite un destino de red privada o local: ${parsed.hostname} (${address})`)
  }
}
