import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/capabilities', () => ({
  resolveCapabilities: vi.fn(),
}))
vi.mock('@/modules/auth/organization-settings.service', () => ({
  getEffectiveOrganizationSettings: vi.fn(),
}))
vi.mock('@/modules/auth/onboarding.service', () => ({
  getOnboardingStatus: vi.fn(),
}))

import { resolveCapabilities } from '@/lib/capabilities'
import { getEffectiveOrganizationSettings } from '@/modules/auth/organization-settings.service'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import type { Session } from 'next-auth'

const mockCaps = vi.mocked(resolveCapabilities)
const mockSettings = vi.mocked(getEffectiveOrganizationSettings)
const mockOnboarding = vi.mocked(getOnboardingStatus)

function session(overrides: Partial<Session['user']> = {}): Session {
  return {
    expires: '2099-01-01T00:00:00.000Z',
    user: {
      id: 'user-1',
      email: 'a@test.com',
      name: 'Admin',
      role: 'admin',
      orgId: 'org-1',
      branchId: null,
      orgRoleId: null,
      actingOrgId: null,
      realRole: 'admin',
      realOrgId: 'org-1',
      realBranchId: null,
      impersonation: null,
      ...overrides,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCaps.mockResolvedValue({
    nav: { panel: true, configuracion: true },
    onboarding: { manage: true },
  } as Awaited<ReturnType<typeof resolveCapabilities>>)
  mockOnboarding.mockResolvedValue({
    completed: false,
    completedAt: null,
    data: null,
    hasProgress: false,
  })
  mockSettings.mockResolvedValue({ enabled_modules: ['sales'] } as Awaited<ReturnType<typeof getEffectiveOrganizationSettings>>)
})

describe('resolvePostAuthRedirect', () => {
  it('sends org admins with fresh onboarding to /onboarding', async () => {
    await expect(resolvePostAuthRedirect(session())).resolves.toBe('/onboarding')
  })

  it('skips onboarding redirect while sys-admin impersonates', async () => {
    await expect(
      resolvePostAuthRedirect(
        session({
          role: 'admin',
          realRole: 'sys-admin',
          impersonation: {
            userId: 'target-1',
            email: 'target@test.com',
            name: 'Target',
            role: 'admin',
          },
        }),
      ),
    ).resolves.toBe('/panel')
  })
})
