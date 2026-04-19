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

export async function createAddress(contactId: string, input: ContactAddressInput) {
  const address = await ContactAddress.create({ ...input, contact_id: contactId })
  logger.info({ contactId, addressId: address.id }, 'address created')
  return address
}

export async function updateAddress(id: string, input: ContactAddressUpdateInput) {
  const address = await ContactAddress.findByPk(id)
  if (!address) throw new Error('ADDRESS_NOT_FOUND')
  await address.update(input)
  logger.info({ addressId: id }, 'address updated')
  return address
}

export async function deleteAddress(id: string) {
  const address = await ContactAddress.findByPk(id)
  if (!address) throw new Error('ADDRESS_NOT_FOUND')
  await address.destroy()
  logger.info({ addressId: id }, 'address deleted')
}
