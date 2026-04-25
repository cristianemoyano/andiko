import 'server-only'
import type { Transaction } from 'sequelize'
import CatalogImportRowAttribute from './catalog-import-row-attribute.model'

export async function persistUnmappedCsvColumns(
  raw: Record<string, string>,
  columnMapping: Record<string, string>,
  importSource: string,
  orgId: string,
  rowExternalId: string,
  productId: string | null,
  variantId: string | null,
  transaction: Transaction,
) {
  const mappedCsvColumns = new Set(Object.values(columnMapping))
  for (const [columnHeader, value] of Object.entries(raw)) {
    if (mappedCsvColumns.has(columnHeader)) continue
    if (value === '' || value == null) continue
    await CatalogImportRowAttribute.create(
      {
        org_id: orgId,
        import_source: importSource,
        row_external_id: rowExternalId.slice(0, 64),
        column_header: columnHeader.slice(0, 255),
        value_text: value.length > 50_000 ? `${value.slice(0, 50_000)}…` : value,
        product_id: productId,
        variant_id: variantId,
      },
      { transaction },
    )
  }
}
