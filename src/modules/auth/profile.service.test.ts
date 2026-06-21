import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindOne = vi.fn()
const mockFindByPk = vi.fn()
const mockFindAll = vi.fn()
const mockUpdate = vi.fn()
const mockValidatePassword = vi.fn()
const mockHashPassword = vi.fn()

vi.mock('@/modules/auth/user.model', () => ({
  default: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}))

vi.mock('@/modules/auth/branch.model', () => ({
  default: {
    findAll: (...args: unknown[]) => mockFindAll(...args),
  },
}))

vi.mock('@/modules/auth/org-role.model', () => ({
  default: {
    findByPk: (...args: unknown[]) => mockFindByPk(...args),
  },
}))

vi.mock('@/modules/auth/organization.model', () => ({
  default: {
    findByPk: (...args: unknown[]) => mockFindByPk(...args),
  },
}))

vi.mock('@/modules/auth/user-branch.model', () => ({
  default: {
    findAll: (...args: unknown[]) => mockFindAll(...args),
  },
}))

vi.mock('@/modules/auth/auth.service', () => ({
  validatePassword: (...args: unknown[]) => mockValidatePassword(...args),
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}))

import { updateUserProfile } from './profile.service'

describe('updateUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHashPassword.mockResolvedValue('hashed')
  })

  it('requires current password for normal users', async () => {
    mockFindOne.mockResolvedValue({
      id: 'u1',
      password_hash: 'hash',
      role: 'admin',
      update: mockUpdate,
    })

    await expect(
      updateUserProfile('u1', { password: 'newpassword1' }, {
        actorRealRole: 'admin',
        isImpersonating: false,
      }),
    ).rejects.toThrow('CURRENT_PASSWORD_REQUIRED')
  })

  it('validates current password for normal users', async () => {
    mockFindOne.mockResolvedValue({
      id: 'u1',
      password_hash: 'hash',
      role: 'admin',
      update: mockUpdate,
    })
    mockValidatePassword.mockResolvedValue(false)

    await expect(
      updateUserProfile('u1', {
        password: 'newpassword1',
        currentPassword: 'wrongpass1',
      }, {
        actorRealRole: 'admin',
        isImpersonating: false,
      }),
    ).rejects.toThrow('CURRENT_PASSWORD_INVALID')
  })

  it('allows sys-admin impersonation password override without current password', async () => {
    const user = {
      id: 'u1',
      password_hash: 'hash',
      role: 'admin',
      update: mockUpdate,
    }
    mockFindOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'admin@demo.local',
        name: 'Gerente Demo',
        role: 'admin',
        org_id: 'org-1',
        branch_id: null,
        org_role_id: null,
      })
    mockFindByPk.mockResolvedValue({ name: 'Demo Org' })
    mockFindAll.mockResolvedValue([])

    const result = await updateUserProfile('u1', { password: 'newpassword1' }, {
      actorRealRole: 'sys-admin',
      isImpersonating: true,
    })

    expect(mockValidatePassword).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ password_hash: 'hashed' })
    expect(result.name).toBe('Gerente Demo')
  })
})
