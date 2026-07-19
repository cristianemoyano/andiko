import { describe, it, expect, vi, beforeEach } from 'vitest'

const { contactFindOne, contactCreate, contactUpdate } = vi.hoisted(() => ({
  contactFindOne: vi.fn(),
  contactCreate: vi.fn(),
  contactUpdate: vi.fn(),
}))

vi.mock('./contact.model', () => ({
  default: {
    findOne: contactFindOne,
    create: contactCreate,
  },
}))

import {
  seedConsumidorFinalContact,
  getConsumidorFinalContact,
  assertContactMutable,
  assertContactDeletable,
  SYSTEM_KEY_CONSUMIDOR_FINAL,
  CONSUMIDOR_FINAL_LEGAL_NAME,
} from './system-contacts'

const fakeT = {} as never

describe('contacts/system-contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('seedConsumidorFinalContact is idempotent when system contact already exists', async () => {
    const existing = { id: 'cf-1', system_key: SYSTEM_KEY_CONSUMIDOR_FINAL }
    contactFindOne.mockResolvedValueOnce(existing)

    const result = await seedConsumidorFinalContact('org-1', fakeT)
    expect(result).toBe(existing)
    expect(contactCreate).not.toHaveBeenCalled()
  })

  it('seedConsumidorFinalContact promotes a matching non-system contact', async () => {
    const candidate = {
      id: 'legacy-cf',
      is_system: false,
      update: contactUpdate,
    }
    contactFindOne
      .mockResolvedValueOnce(null) // by system_key
      .mockResolvedValueOnce(candidate) // by legal_name match
    contactUpdate.mockResolvedValue(undefined)

    const result = await seedConsumidorFinalContact('org-1', fakeT, 'actor-1')
    expect(result).toBe(candidate)
    expect(contactUpdate).toHaveBeenCalledWith(
      {
        is_system: true,
        system_key: SYSTEM_KEY_CONSUMIDOR_FINAL,
        is_active: true,
        updated_by: 'actor-1',
      },
      { transaction: fakeT },
    )
    expect(contactCreate).not.toHaveBeenCalled()
  })

  it('seedConsumidorFinalContact creates the protected CF contact when missing', async () => {
    contactFindOne.mockResolvedValue(null)
    const created = { id: 'new-cf' }
    contactCreate.mockResolvedValue(created)

    const result = await seedConsumidorFinalContact('org-1', fakeT, 'actor-1')
    expect(result).toBe(created)
    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        type: 'customer',
        legal_name: CONSUMIDOR_FINAL_LEGAL_NAME,
        iva_condition: 'consumidor_final',
        cuit: null,
        is_system: true,
        system_key: SYSTEM_KEY_CONSUMIDOR_FINAL,
      }),
      { transaction: fakeT },
    )
  })

  it('getConsumidorFinalContact looks up by system_key', async () => {
    contactFindOne.mockResolvedValue({ id: 'cf-1' })
    const result = await getConsumidorFinalContact('org-1')
    expect(result).toEqual({ id: 'cf-1' })
    expect(contactFindOne).toHaveBeenCalledWith({
      where: { org_id: 'org-1', system_key: SYSTEM_KEY_CONSUMIDOR_FINAL },
    })
  })

  it('blocks mutate/delete of system contacts', () => {
    const system = { is_system: true } as never
    expect(() => assertContactMutable(system)).toThrow('SYSTEM_CONTACT_NOT_EDITABLE')
    expect(() => assertContactDeletable(system)).toThrow('SYSTEM_CONTACT_NOT_DELETABLE')
  })

  it('allows mutate/delete of normal contacts', () => {
    const normal = { is_system: false } as never
    expect(() => assertContactMutable(normal)).not.toThrow()
    expect(() => assertContactDeletable(normal)).not.toThrow()
  })
})
