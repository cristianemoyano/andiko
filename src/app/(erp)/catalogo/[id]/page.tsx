import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/primitives/Badge'
import { Image } from '@/components/primitives/Image'
import { auth } from '@/lib/auth'
import type { AuthedSession } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { getProduct } from '@/modules/catalog/products.service'
import type ProductVariant from '@/modules/catalog/product-variant.model'
import { ProductDetailClient } from './ProductDetailClient'
import { CatalogoSubNav } from '../CatalogoSubNav'
import { VariantsSectionClient } from './VariantsSectionClient'

export const metadata = { title: 'Producto — Andiko ERP' }

const STATUS_BADGE: Record<string, 'neutral' | 'success' | 'draft'> = {
  draft:    'draft',
  active:   'success',
  archived: 'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', active: 'Activo', archived: 'Archivado',
}

const IVA_LABEL: Record<string, string> = {
  '0': 'Exento (0%)', '10.5': '10,5%', '21': '21%', '27': '27%',
}

const TYPE_LABEL: Record<string, string> = {
  simple: 'Producto', service: 'Servicio',
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) notFound()
  const authed = session as AuthedSession
  let product: Awaited<ReturnType<typeof getProduct>> | null = null
  try {
    const ctxTenant = await makeTenantContext(authed.user)
    product = await getProduct(id, ctxTenant)
  } catch {
    product = null
  }
  if (!product) notFound()

  const productJson = product.toJSON() as unknown as {
    category?: { name: string } | null
    images?: Array<{ url: string; alt: string | null; position: number }>
  }

  const variants = (product as unknown as { variants?: ProductVariant[] }).variants
  const variant = variants?.[0]
  const categoryName = productJson.category?.name ?? '—'
  const images = (productJson.images ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Catálogo', href: '/catalogo/productos' },
          { label: 'Productos', href: '/catalogo/productos' },
          { label: product.name },
        ]}
        actions={<ProductDetailClient product={product.toJSON() as unknown as Parameters<typeof ProductDetailClient>[0]['product']} />}
      />
      <CatalogoSubNav />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="w-full max-w-6xl space-y-4">

          {/* Header */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-base font-semibold text-zinc-900">{product.name}</h1>
                <Badge status={STATUS_BADGE[product.status] ?? 'neutral'}>
                  {STATUS_LABEL[product.status] ?? product.status}
                </Badge>
              </div>
              {product.vendor && <p className="text-xs text-zinc-500">{product.vendor}</p>}
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-4 items-start ${images.length > 0 ? 'lg:grid-cols-2' : ''}`}>
            <div className="space-y-4">
              {/* Info general */}
              <Section title="Información general">
                <Row label="Tipo"              value={TYPE_LABEL[product.product_type] ?? product.product_type} />
                <Row label="Categoría"         value={categoryName} />
                <Row label="Alícuota IVA"      value={IVA_LABEL[product.iva_rate] ?? product.iva_rate} />
                <Row label="Unidad de medida"  value={product.unit_of_measure} />
                {product.ncm_code && <Row label="Código NCM" value={product.ncm_code} />}
                {product.description && <Row label="Descripción" value={product.description} />}
              </Section>

              {/* SKU / Precios */}
              {variant && (
                <Section title="SKU y precios">
                  <Row label="SKU"                value={variant.sku} mono />
                  {variant.barcode     && <Row label="Código de barras" value={variant.barcode} mono />}
                  {variant.cost_price  && <Row label="Precio de costo"  value={`$${Number(variant.cost_price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} />}
                  {variant.base_price  && <Row label="Precio base"      value={`$${Number(variant.base_price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} />}
                  <Row label="Stock"
                    value={variant.manage_stock
                      ? String(variant.stock_quantity)
                      : 'Sin seguimiento de stock'}
                  />
                </Section>
              )}

              {variants && (
                <VariantsSectionClient
                  productId={product.id}
                  productName={product.name}
                  variants={variants.map((v) => ({
                    id: v.id,
                    sku: v.sku,
                    name: v.name ?? null,
                    base_price: v.base_price ?? null,
                    cost_price: v.cost_price ?? null,
                    barcode: v.barcode ?? null,
                    manage_stock: v.manage_stock,
                    stock_quantity: v.stock_quantity,
                    is_default: v.is_default,
                    weight_kg: v.weight_kg ?? null,
                    length_cm: v.length_cm ?? null,
                    width_cm: v.width_cm ?? null,
                    height_cm: v.height_cm ?? null,
                    units_per_package: v.units_per_package ?? null,
                  }))}
                />
              )}
            </div>

            {/* Imágenes */}
            {images.length > 0 && (
              <Section title="Imágenes">
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((im) => (
                      <Image
                        key={`${im.url}-${im.position}`}
                        src={im.url}
                        alt={im.alt ?? product.name}
                        width={360}
                        height={360}
                        className="h-28 w-full"
                      />
                    ))}
                  </div>
                </div>
              </Section>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-sm">
      <div className="px-4 py-2.5 border-b border-zinc-100">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="divide-y divide-zinc-100">{children}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="text-xs text-zinc-500 w-40 flex-shrink-0">{label}</span>
      <span className={`text-sm text-zinc-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
