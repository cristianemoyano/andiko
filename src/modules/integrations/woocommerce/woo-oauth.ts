import { createHmac, randomBytes } from 'node:crypto'

const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA256'

/** PHP `rawurlencode` (RFC 3986) as used by WooCommerce. */
function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function normalizeParameters(sorted: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(sorted)) {
    out[rfc3986Encode(key)] = rfc3986Encode(sorted[key]!)
  }
  return out
}

function joinWithEqualsSign(params: Record<string, string>): string[] {
  return Object.keys(params).map((k) => rfc3986Encode(`${k}=${params[k]!}`))
}

/**
 * Signs an HTTP request with WooCommerce OAuth 1.0a (one-legged).
 * Required for non-TLS stores — Basic/query credentials are ignored over HTTP.
 */
export function signWooHttpRequest(
  method: string,
  url: URL,
  consumerKey: string,
  consumerSecret: string,
): void {
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    params[k] = v
  })

  params.oauth_consumer_key = consumerKey
  params.oauth_timestamp = String(Math.floor(Date.now() / 1000))
  params.oauth_nonce = randomBytes(16).toString('hex')
  params.oauth_signature_method = OAUTH_SIGNATURE_METHOD

  const sortedKeys = Object.keys(params).sort()
  const sorted: Record<string, string> = {}
  for (const k of sortedKeys) sorted[k] = params[k]!

  const normalized = normalizeParameters(sorted)
  const queryString = joinWithEqualsSign(normalized).join('%26')
  const baseRequestUri = rfc3986Encode(`${url.protocol}//${url.host}${url.pathname}`)
  const stringToSign = `${method.toUpperCase()}&${baseRequestUri}&${queryString}`

  const signature = createHmac('sha256', `${consumerSecret}&`).update(stringToSign).digest('base64')

  url.search = ''
  for (const [k, v] of Object.entries({ ...sorted, oauth_signature: signature })) {
    url.searchParams.set(k, v)
  }
}
