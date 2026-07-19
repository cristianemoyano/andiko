import 'server-only'
import ContactAddress from './contact-address.model'
import type { ContactAddressInput, ContactAddressUpdateInput } from './contact-address.schema'
import { getContact } from './contacts.service'
import { assertContactMutable } from './system-contacts'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'

export async function listAddresses(contactId: string, ctx: TenantContext) {
  return ContactAddress.findAll({
    where: whereOrg(ctx, { contact_id: contactId }),
    order: [['is_default', 'DESC'], ['created_at', 'ASC']],
  })
}

async function assertParentContactMutable(contactId: string, ctx: TenantContext) {
  const contact = await getContact(contactId, ctx)
  assertContactMutable(contact)
}

export async function createAddress(contactId: string, input: ContactAddressInput, ctx: TenantContext, actorId: string) {
  await assertParentContactMutable(contactId, ctx)
  const address = await ContactAddress.create({
    ...input,
    contact_id: contactId,
    org_id: ctx.orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ contactId, addressId: address.id, actorId }, 'address created')
  return address
}

export async function updateAddress(id: string, input: ContactAddressUpdateInput, ctx: TenantContext, actorId: string) {
  const address = await ContactAddress.findOne({ where: whereOrg(ctx, { id }) })
  if (!address) throw new Error('ADDRESS_NOT_FOUND')
  await assertParentContactMutable(address.contact_id, ctx)
  await address.update({ ...input, updated_by: actorId })
  logger.info({ addressId: id, actorId }, 'address updated')
  return address
}

export async function deleteAddress(id: string, ctx: TenantContext, actorId: string) {
  const address = await ContactAddress.findOne({ where: whereOrg(ctx, { id }) })
  if (!address) throw new Error('ADDRESS_NOT_FOUND')
  await assertParentContactMutable(address.contact_id, ctx)
  await address.update({ deleted_by: actorId })
  await address.destroy()
  logger.info({ addressId: id, actorId }, 'address deleted')
}
