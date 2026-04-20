import 'server-only'
import ContactPaymentInfo from './contact-payment-info.model'
import type { ContactPaymentInfoInput, ContactPaymentInfoUpdateInput } from './contact-payment-info.schema'
import logger from '@/lib/logger'

export async function listPaymentInfo(contactId: string) {
  return ContactPaymentInfo.findAll({
    where: { contact_id: contactId },
    order: [['created_at', 'ASC']],
  })
}

export async function createPaymentInfo(contactId: string, input: ContactPaymentInfoInput, actorId: string) {
  const paymentInfo = await ContactPaymentInfo.create({
    ...input,
    contact_id: contactId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ contactId, paymentInfoId: paymentInfo.id, actorId }, 'payment info created')
  return paymentInfo
}

export async function updatePaymentInfo(id: string, input: ContactPaymentInfoUpdateInput, actorId: string) {
  const paymentInfo = await ContactPaymentInfo.findByPk(id)
  if (!paymentInfo) throw new Error('PAYMENT_INFO_NOT_FOUND')
  await paymentInfo.update({ ...input, updated_by: actorId })
  logger.info({ paymentInfoId: id, actorId }, 'payment info updated')
  return paymentInfo
}

export async function deletePaymentInfo(id: string, actorId: string) {
  const paymentInfo = await ContactPaymentInfo.findByPk(id)
  if (!paymentInfo) throw new Error('PAYMENT_INFO_NOT_FOUND')
  await paymentInfo.update({ deleted_by: actorId })
  await paymentInfo.destroy()
  logger.info({ paymentInfoId: id, actorId }, 'payment info deleted')
}
