import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: { transaction: vi.fn((cb: (t: object) => Promise<unknown>) => cb({})) },
}))

vi.mock('./bom.model', () => ({
  default: { findOne: vi.fn(), findAndCountAll: vi.fn(), create: vi.fn() },
}))

vi.mock('./bom-item.model', () => ({
  default: { create: vi.fn() },
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({ default: {} }))
vi.mock('@/modules/catalog/product.model', () => ({ default: {} }))

vi.mock('./production-order.model', () => ({
  default: { count: vi.fn() },
}))

import BillOfMaterials from './bom.model'
import BomItem from './bom-item.model'
import ProductionOrder from './production-order.model'
import { createBom, replaceBom, deactivateBom } from './boms.service'

const T = {} as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createBom', () => {
  it('rejects when a component is the same variant as the finished product', async () => {
    await expect(
      createBom(
        {
          variant_id: 'var-1',
          name: 'Receta',
          output_quantity: 1,
          items: [{ component_variant_id: 'var-1', quantity: 1, scrap_pct: 0, sort_order: 0 }],
        },
        'org-1',
        'actor-1',
      ),
    ).rejects.toThrow('BOM_SELF_REFERENCE')
    expect(BillOfMaterials.create).not.toHaveBeenCalled()
  })

  it('rejects when an active BOM already exists for the variant', async () => {
    ;(BillOfMaterials.findOne as Mock).mockResolvedValueOnce({ id: 'existing-bom' })

    await expect(
      createBom(
        {
          variant_id: 'var-1',
          name: 'Receta',
          output_quantity: 1,
          items: [{ component_variant_id: 'comp-1', quantity: 1, scrap_pct: 0, sort_order: 0 }],
        },
        'org-1',
        'actor-1',
      ),
    ).rejects.toThrow('BOM_ALREADY_ACTIVE')
    expect(BillOfMaterials.create).not.toHaveBeenCalled()
  })

  it('creates the BOM header and its items when there is no active BOM yet', async () => {
    ;(BillOfMaterials.findOne as Mock)
      .mockResolvedValueOnce(null) // duplicate-active check
      .mockResolvedValueOnce({ id: 'bom-1', variant_id: 'var-1', items: [] }) // getBom after commit
    ;(BillOfMaterials.create as Mock).mockResolvedValue({ id: 'bom-1' })
    ;(BomItem.create as Mock).mockResolvedValue({})

    await createBom(
      {
        variant_id: 'var-1',
        name: 'Receta',
        output_quantity: 1,
        items: [{ component_variant_id: 'comp-1', quantity: 2, scrap_pct: 5, sort_order: 0 }],
      },
      'org-1',
      'actor-1',
    )

    expect(BillOfMaterials.create).toHaveBeenCalledWith(
      expect.objectContaining({ variant_id: 'var-1', is_active: true, org_id: 'org-1' }),
      { transaction: T },
    )
    expect(BomItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ bom_id: 'bom-1', component_variant_id: 'comp-1', quantity: '2', scrap_pct: '5' }),
      { transaction: T },
    )
  })
})

describe('replaceBom', () => {
  it('deactivates the current BOM and creates a brand-new active version', async () => {
    const current = { id: 'bom-1', variant_id: 'var-1', name: 'Vieja', output_quantity: '1', notes: null, update: vi.fn().mockResolvedValue(undefined) }
    ;(BillOfMaterials.findOne as Mock)
      .mockResolvedValueOnce(current) // lock current
      .mockResolvedValueOnce({ id: 'bom-2', items: [] }) // getBom after commit
    ;(BillOfMaterials.create as Mock).mockResolvedValue({ id: 'bom-2' })

    await replaceBom(
      'bom-1',
      { name: 'Nueva', items: [{ component_variant_id: 'comp-1', quantity: 3, scrap_pct: 0, sort_order: 0 }] },
      'org-1',
      'actor-1',
    )

    expect(current.update).toHaveBeenCalledWith({ is_active: false, updated_by: 'actor-1' }, { transaction: T })
    expect(BillOfMaterials.create).toHaveBeenCalledWith(
      expect.objectContaining({ variant_id: 'var-1', is_active: true, name: 'Nueva' }),
      { transaction: T },
    )
  })

  it('rejects when a replacement component is the finished variant itself', async () => {
    const current = { id: 'bom-1', variant_id: 'var-1', update: vi.fn() }
    ;(BillOfMaterials.findOne as Mock).mockResolvedValueOnce(current)

    await expect(
      replaceBom('bom-1', { items: [{ component_variant_id: 'var-1', quantity: 1, scrap_pct: 0, sort_order: 0 }] }, 'org-1', 'actor-1'),
    ).rejects.toThrow('BOM_SELF_REFERENCE')
    expect(current.update).not.toHaveBeenCalled()
  })
})

describe('deactivateBom', () => {
  it('blocks deactivation while a non-terminal production order references the BOM', async () => {
    const bom = { id: 'bom-1', update: vi.fn() }
    ;(BillOfMaterials.findOne as Mock).mockResolvedValueOnce(bom)
    ;(ProductionOrder.count as Mock).mockResolvedValueOnce(1)

    await expect(deactivateBom('bom-1', 'org-1', 'actor-1')).rejects.toThrow('BOM_IN_USE')
    expect(bom.update).not.toHaveBeenCalled()
  })

  it('soft-deletes the BOM when it is not referenced by any active order', async () => {
    const bom = { id: 'bom-1', update: vi.fn().mockResolvedValue(undefined), destroy: vi.fn().mockResolvedValue(undefined) }
    ;(BillOfMaterials.findOne as Mock).mockResolvedValueOnce(bom)
    ;(ProductionOrder.count as Mock).mockResolvedValueOnce(0)

    await deactivateBom('bom-1', 'org-1', 'actor-1')

    expect(bom.update).toHaveBeenCalledWith({ is_active: false, deleted_by: 'actor-1' }, { transaction: T })
    expect(bom.destroy).toHaveBeenCalledWith({ transaction: T })
  })
})
