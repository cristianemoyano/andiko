'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/primitives/Button'
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

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        Editar
      </Button>

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
    </>
  )
}

