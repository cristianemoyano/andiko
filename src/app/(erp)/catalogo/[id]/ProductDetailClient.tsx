'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { ProductModal } from '../ProductModal'

type ProductForEdit = {
  id: string
  name: string
  product_type: string
  status: string
  iva_rate: string
  unit_of_measure: string
  vendor: string | null
  category_id: string | null
  description: string | null
  variants: Array<{
    sku: string
    base_price: string | null
    cost_price: string | null
    barcode: string | null
  }>
}

export function ProductDetailClient({ product }: { product: ProductForEdit }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const editProduct = useMemo<ProductForEdit>(() => {
    const v0 = product.variants?.[0]
    return {
      ...product,
      variants: [
        {
          sku: v0?.sku ?? '',
          base_price: v0?.base_price ?? null,
          cost_price: v0?.cost_price ?? null,
          barcode: v0?.barcode ?? null,
        },
      ],
    }
  }, [product])

  async function handleDelete() {
    const res = await fetch(`/api/v1/catalog/products/${product.id}`, { method: 'DELETE' })
    setConfirmDelete(false)
    if (!res.ok && res.status !== 204) return
    router.push('/catalogo/productos')
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
          Eliminar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </div>

      {editing && (
        <ProductModal
          product={editProduct}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar producto"
        description={`Se eliminará ${product.name}.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </>
  )
}

