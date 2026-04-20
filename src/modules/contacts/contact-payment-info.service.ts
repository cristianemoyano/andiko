import 'server-only'
import sequelize from '@/lib/db'
import ContactPaymentInfo from './contact-payment-info.model'
import type { ContactPaymentInfoInput, ContactPaymentInfoUpdateInput } from './contact-payment-info.schema'
import logger from '@/lib/logger'

export async function listPaymentInfo(contactId: string) {
  return ContactPaymentInfo.findAll({
    where: { contact_id: contactId },
    order: [['is_default', 'DESC'], ['created_at', 'ASC']],
  })
}

export async function createPaymentInfo(contactId: string, input: ContactPaymentInfoInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    if (input.is_default) {
      await ContactPaymentInfo.update(
        { is_default: false, updated_by: actorId },
        { where: { contact_id: contactId }, transaction: t }
      )
    }
    const paymentInfo = await ContactPaymentInfo.create(
      { ...input, contact_id: contactId, created_by: actorId, updated_by: actorId },
      { transaction: t }
    )
    logger.info({ contactId, paymentInfoId: paymentInfo.id, actorId }, 'payment info created')
    return paymentInfo
  })
}

export async function updatePaymentInfo(id: string, input: ContactPaymentInfoUpdateInput, actorId: string) {
  return sequelize.transaction(async (t) => {
    const paymentInfo = await ContactPaymentInfo.findByPk(id, { transaction: t })
    if (!paymentInfo) throw new Error('PAYMENT_INFO_NOT_FOUND')

    if (input.is_default) {
      await ContactPaymentInfo.update(
        { is_default: false, updated_by: actorId },
        { where: { contact_id: paymentInfo.contact_id }, transaction: t }
      )
    }

    await paymentInfo.update({ ...input, updated_by: actorId }, { transaction: t })
    logger.info({ paymentInfoId: id, actorId }, 'payment info updated')
    return paymentInfo
  })
}

export async function deletePaymentInfo(id: string, actorId: string) {
  const paymentInfo = await ContactPaymentInfo.findByPk(id)
  if (!paymentInfo) throw new Error('PAYMENT_INFO_NOT_FOUND')
  await paymentInfo.update({ deleted_by: actorId })
  await paymentInfo.destroy()
  logger.info({ paymentInfoId: id, actorId }, 'payment info deleted')
}
