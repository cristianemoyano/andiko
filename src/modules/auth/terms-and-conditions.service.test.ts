import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('./organization-setting.model', () => ({
  default: { findOne: vi.fn(), create: vi.fn() },
}))
vi.mock('./organization.model', () => ({
  default: { findByPk: vi.fn() },
}))

import OrganizationSetting from './organization-setting.model'
import Organization from './organization.model'
import { getTermsAndConditions, updateTermsAndConditions } from './terms-and-conditions.service'

const findOneMock = OrganizationSetting.findOne as unknown as Mock
const createMock = OrganizationSetting.create as unknown as Mock
const findByPkMock = Organization.findByPk as unknown as Mock

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getTermsAndConditions', () => {
  it('returns the stored text for the org', async () => {
    findOneMock.mockResolvedValueOnce({ terms_and_conditions: 'Términos de ejemplo' })

    const result = await getTermsAndConditions('org-1')

    expect(result).toEqual({ org_id: 'org-1', terms_and_conditions: 'Términos de ejemplo' })
    expect(findOneMock).toHaveBeenCalledWith(expect.objectContaining({ where: { org_id: 'org-1' } }))
  })

  it('returns null when the org has no settings row', async () => {
    findOneMock.mockResolvedValueOnce(null)

    const result = await getTermsAndConditions('org-2')

    expect(result).toEqual({ org_id: 'org-2', terms_and_conditions: null })
  })
})

describe('updateTermsAndConditions', () => {
  it('throws ORG_NOT_FOUND when the org does not exist', async () => {
    findByPkMock.mockResolvedValueOnce(null)

    await expect(updateTermsAndConditions('org-x', 'texto')).rejects.toThrow('ORG_NOT_FOUND')
  })

  it('updates the existing settings row when present', async () => {
    findByPkMock.mockResolvedValueOnce({ id: 'org-1' })
    const updateMock = vi.fn()
    findOneMock.mockResolvedValueOnce({ update: updateMock })

    const result = await updateTermsAndConditions('org-1', 'Nuevo texto')

    expect(updateMock).toHaveBeenCalledWith({ terms_and_conditions: 'Nuevo texto' })
    expect(createMock).not.toHaveBeenCalled()
    expect(result).toEqual({ org_id: 'org-1', terms_and_conditions: 'Nuevo texto' })
  })

  it('creates a settings row when none exists yet', async () => {
    findByPkMock.mockResolvedValueOnce({ id: 'org-1' })
    findOneMock.mockResolvedValueOnce(null)

    const result = await updateTermsAndConditions('org-1', 'Primer texto')

    expect(createMock).toHaveBeenCalledWith({ org_id: 'org-1', terms_and_conditions: 'Primer texto' })
    expect(result).toEqual({ org_id: 'org-1', terms_and_conditions: 'Primer texto' })
  })

  it('allows clearing the text with null', async () => {
    findByPkMock.mockResolvedValueOnce({ id: 'org-1' })
    const updateMock = vi.fn()
    findOneMock.mockResolvedValueOnce({ update: updateMock })

    const result = await updateTermsAndConditions('org-1', null)

    expect(updateMock).toHaveBeenCalledWith({ terms_and_conditions: null })
    expect(result.terms_and_conditions).toBeNull()
  })
})
