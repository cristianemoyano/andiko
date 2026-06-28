import 'server-only'
import type { Permission } from '@/lib/permissions'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg, whereAllowedBranches } from '@/lib/tenancy'
import type { FileOwnerType } from './file-link.model'

/**
 * Per owner-type rules used to derive **inherited** file access: which module permission
 * gates the owner, and whether a specific owner record is visible within the caller's
 * tenant/branch scope.
 *
 * This is the single, one-directional extension point (storage → other modules; nothing
 * imports storage back, so no cycle). Adding a new attachable entity = one entry here.
 */
export interface OwnerResolver {
  readPermission: Permission
  writePermission: Permission
  /** True when the owner record exists and is visible to the caller (org/branch scoped). */
  exists(ownerId: string, ctx: TenantContext): Promise<boolean>
}

export const OWNER_RESOLVERS: Record<FileOwnerType, OwnerResolver> = {
  invoice: {
    readPermission: 'sales:read',
    writePermission: 'sales:write',
    async exists(ownerId, ctx) {
      const { default: Invoice } = await import('@/modules/sales/invoice.model')
      const row = await Invoice.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
  },
  product: {
    readPermission: 'products:read',
    writePermission: 'products:write',
    async exists(ownerId, ctx) {
      const { default: Product } = await import('@/modules/catalog/product.model')
      const row = await Product.findOne({
        where: whereOrg(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
  },
  contact: {
    readPermission: 'contacts:read',
    writePermission: 'contacts:write',
    async exists(ownerId, ctx) {
      const { default: Contact } = await import('@/modules/contacts/contact.model')
      const row = await Contact.findOne({
        where: whereOrg(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
  },
}
