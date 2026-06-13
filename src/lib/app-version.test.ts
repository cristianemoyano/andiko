import { describe, expect, it, afterEach } from 'vitest'
import { resolveAppVersion } from '../../resolve-app-version'

describe('resolveAppVersion', () => {
  const originalRef = process.env.VERCEL_GIT_COMMIT_REF

  afterEach(() => {
    if (originalRef === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_REF
    } else {
      process.env.VERCEL_GIT_COMMIT_REF = originalRef
    }
  })

  it('uses Vercel git tag when deployed from a release', () => {
    process.env.VERCEL_GIT_COMMIT_REF = 'v0.5.0'
    expect(resolveAppVersion()).toBe('v0.5.0')
  })

  it('falls back to package.json version for branch deploys', () => {
    process.env.VERCEL_GIT_COMMIT_REF = 'develop'
    expect(resolveAppVersion()).toBe('v0.5.0')
  })

  it('falls back to package.json version when git ref is missing', () => {
    delete process.env.VERCEL_GIT_COMMIT_REF
    expect(resolveAppVersion()).toBe('v0.5.0')
  })
})
