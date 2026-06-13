import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** Build-time only — do not import from app code (uses node:fs). */
export function resolveAppVersion(): string {
  const gitRef = process.env.VERCEL_GIT_COMMIT_REF
  if (gitRef && /^v\d+\.\d+\.\d+/.test(gitRef)) return gitRef
  return `v${readPackageVersion()}`
}
