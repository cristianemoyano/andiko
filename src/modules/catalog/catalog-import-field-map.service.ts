import 'server-only'
import { Op } from 'sequelize'
import CatalogImportFieldMap from './catalog-import-field-map.model'
import { isValidProductImportInternalKey } from './products-csv-adapter'
import type { UUID } from '@/types'

export async function listCatalogImportFieldMaps(orgId: UUID, profile: string | null) {
  const where: Record<string, unknown> = { org_id: orgId }
  if (profile === null || profile === '') {
    where.profile = { [Op.or]: [{ [Op.eq]: null }, { [Op.eq]: '' }] }
  } else {
    where.profile = profile
  }
  return CatalogImportFieldMap.findAll({
    where,
    attributes: ['external_header', 'internal_field_key', 'profile'],
    order: [['external_header', 'ASC']],
  })
}

export async function replaceCatalogImportFieldMaps(
  orgId: UUID,
  profile: string | null,
  rows: { external_header: string; internal_field_key: string }[],
) {
  for (const row of rows) {
    if (!isValidProductImportInternalKey(row.internal_field_key)) {
      throw new Error('INVALID_INTERNAL_FIELD_KEY')
    }
  }
  const prof = profile === '' ? null : profile
  await CatalogImportFieldMap.destroy({
    where: {
      org_id: orgId,
      ...(prof == null ? { profile: { [Op.or]: [{ [Op.eq]: null }, { [Op.eq]: '' }] } } : { profile: prof }),
    },
  })
  await CatalogImportFieldMap.bulkCreate(
    rows.map((r) => ({
      org_id: orgId,
      profile: prof,
      external_header: r.external_header.trim(),
      internal_field_key: r.internal_field_key,
    })),
  )
}
