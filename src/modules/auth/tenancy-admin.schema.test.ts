import { describe, it, expect, vi } from 'vitest'

vi.mock('@/modules/auth/organization.model', () => ({
  ORG_IVA_CONDITIONS: [
    'responsable_inscripto',
    'monotributista',
    'consumidor_final',
    'exento',
    'no_responsable',
  ],
}))

import { organizationUpdateSchema } from './tenancy-admin.schema'

describe('organizationUpdateSchema', () => {
  it('accepts name and fiscal fields', () => {
    const parsed = organizationUpdateSchema.safeParse({ name: 'Acme SA' })
    expect(parsed.success).toBe(true)
  })

  it('rejects slug changes after creation', () => {
    const parsed = organizationUpdateSchema.safeParse({ slug: 'otro-slug' })
    expect(parsed.success).toBe(false)
  })

  it('accepts a timezone override', () => {
    const parsed = organizationUpdateSchema.safeParse({ timezone: 'America/Mexico_City' })
    expect(parsed.success).toBe(true)
  })

  it('rejects an empty timezone', () => {
    const parsed = organizationUpdateSchema.safeParse({ timezone: '' })
    expect(parsed.success).toBe(false)
  })
})
