import 'server-only'
import ContactAddress from './contact-address.model'
import type { ContactAddressInput, ContactAddressUpdateInput } from './contact-address.schema'
import logger from '@/lib/logger'

export async function listAddresses(contactId: string) {
  return ContactAddress.findAll({
    where: { contact_id: contactId },
    order: [['is_default', 'DESC'], ['created_at', 'ASC']],
  })
}

export async function createAddress(contactId: string, input: ContactAddressInput, actorId: string) {
  const address = await ContactAddress.create({
    ...input,
    contact_id: contactId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ contactId, addressId: address.id, actorId }, 'address created')
  return address
}

export async function updateAddress(id: string, input: ContactAddressUpdateInput, actorId: string) {
  const address = await ContactAddress.findByPk(id)
  if (!address) throw new Error('ADDRESS_NOT_FOUND')
  await address.update({ ...input, updated_by: actorId })
  logger.info({ addressId: id, actorId }, 'address updated')
  return address
}

export async function deleteAddress(id: string, actorId: string) {
  const address = await ContactAddress.findByPk(id)
  if (!address) throw new Error('ADDRESS_NOT_FOUND')
  await address.update({ deleted_by: actorId })
  await address.destroy()
  logger.info({ addressId: id, actorId }, 'address deleted')
}
