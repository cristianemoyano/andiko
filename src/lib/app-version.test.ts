import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { resolveAppVersion } from '../../resolve-app-version'

const pkgVersion = (
  JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as { version: string }
).version

describe('resolveAppVersion', () => {
  const originalRef = process.env.VERCEL_GIT_COMMIT_REF
  const originalAppVersion = process.env.APP_VERSION

  afterEach(() => {
    if (originalRef === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_REF
    } else {
      process.env.VERCEL_GIT_COMMIT_REF = originalRef
    }
    if (originalAppVersion === undefined) {
      delete process.env.APP_VERSION
    } else {
      process.env.APP_VERSION = originalAppVersion
    }
  })

  it('prefers APP_VERSION from Docker prod builds', () => {
    process.env.APP_VERSION = 'v0.44.2'
    expect(resolveAppVersion()).toBe('v0.44.2')
  })

  it('normalizes APP_VERSION without v prefix', () => {
    process.env.APP_VERSION = '0.44.2'
    expect(resolveAppVersion()).toBe('v0.44.2')
  })

  it('uses Vercel git tag when deployed from a release', () => {
    process.env.VERCEL_GIT_COMMIT_REF = 'v0.5.0'
    expect(resolveAppVersion()).toBe('v0.5.0')
  })

  it('falls back to package.json version for branch deploys', () => {
    process.env.VERCEL_GIT_COMMIT_REF = 'develop'
    expect(resolveAppVersion()).toBe(`v${pkgVersion}`)
  })

  it('falls back to package.json version when git ref is missing', () => {
    delete process.env.VERCEL_GIT_COMMIT_REF
    expect(resolveAppVersion()).toBe(`v${pkgVersion}`)
  })
})
