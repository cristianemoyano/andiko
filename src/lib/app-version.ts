/** Client-safe version string injected at build time via next.config env. */
export function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'
}
