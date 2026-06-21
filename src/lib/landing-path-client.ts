/** Resuelve la primera pantalla útil post-login (client-side). */
export async function fetchLandingPath(): Promise<string> {
  try {
    const res = await fetch('/api/v1/session/landing-path')
    if (!res.ok) return '/configuracion'
    const data = (await res.json()) as { path?: string }
    return data.path ?? '/configuracion'
  } catch {
    return '/configuracion'
  }
}
