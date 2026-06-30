import { describe, expect, it } from 'vitest'
import {
  isOnboardingPath,
  shouldLayoutForceOnboardingRedirect,
  shouldSkipOnboardingEnforcement,
} from './onboarding-guards'

describe('isOnboardingPath', () => {
  it('matches onboarding routes', () => {
    expect(isOnboardingPath('/onboarding')).toBe(true)
    expect(isOnboardingPath('/onboarding/foo')).toBe(true)
  })

  it('does not match other routes', () => {
    expect(isOnboardingPath('/panel')).toBe(false)
    expect(isOnboardingPath('')).toBe(false)
  })
})

describe('shouldLayoutForceOnboardingRedirect', () => {
  const incomplete = { completed: false, hasProgress: false }

  it('forces redirect on known non-onboarding paths', () => {
    expect(shouldLayoutForceOnboardingRedirect('/panel', incomplete)).toBe(true)
  })

  it('does not redirect on onboarding path', () => {
    expect(shouldLayoutForceOnboardingRedirect('/onboarding', incomplete)).toBe(false)
  })

  it('does not redirect when pathname is unknown (avoids infinite loop)', () => {
    expect(shouldLayoutForceOnboardingRedirect('', incomplete)).toBe(false)
  })

  it('does not redirect when onboarding has progress or is complete', () => {
    expect(shouldLayoutForceOnboardingRedirect('/panel', { completed: true, hasProgress: false })).toBe(false)
    expect(shouldLayoutForceOnboardingRedirect('/panel', { completed: false, hasProgress: true })).toBe(false)
  })
})

describe('shouldSkipOnboardingEnforcement', () => {
  it('skips when sys-admin is impersonating', () => {
    expect(
      shouldSkipOnboardingEnforcement({
        realRole: 'sys-admin',
        impersonation: { userId: 'u-1' },
      }),
    ).toBe(true)
  })

  it('does not skip for real org admin login', () => {
    expect(
      shouldSkipOnboardingEnforcement({
        realRole: 'admin',
        impersonation: null,
      }),
    ).toBe(false)
  })

  it('does not skip for sys-admin without impersonation', () => {
    expect(
      shouldSkipOnboardingEnforcement({
        realRole: 'sys-admin',
        impersonation: null,
      }),
    ).toBe(false)
  })
})
