import 'server-only'
import sequelize from '@/lib/db'
import ContactPaymentInfo from './contact-payment-info.model'
import type { ContactPaymentInfoInput, ContactPaymentInfoUpdateInput } from './contact-payment-info.schema'
import { getContact } from './contacts.service'
import { assertContactMutable } from './system-contacts'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'

export async function listPaymentInfo(contactId: string, ctx: TenantContext) {
  return ContactPaymentInfo.findAll({
    where: whereOrg(ctx, { contact_id: contactId }),
    order: [['is_default', 'DESC'], ['created_at', 'ASC']],
  })
}

async function assertParentContactMutable(contactId: string, ctx: TenantContext) {
  const contact = await getContact(contactId, ctx)
  assertContactMutable(contact)
}

export async function createPaymentInfo(contactId: string, input: ContactPaymentInfoInput, ctx: TenantContext, actorId: string) {
  await assertParentContactMutable(contactId, ctx)
  return sequelize.transaction(async (t) => {
    if (input.is_default) {
      await ContactPaymentInfo.update(
        { is_default: false, updated_by: actorId },
        { where: whereOrg(ctx, { contact_id: contactId }), transaction: t }
      )
    }
    const paymentInfo = await ContactPaymentInfo.create(
      { ...input, contact_id: contactId, org_id: ctx.orgId, created_by: actorId, updated_by: actorId },
      { transaction: t }
    )
    logger.info({ contactId, paymentInfoId: paymentInfo.id, actorId }, 'payment info created')
    return paymentInfo
  })
}

export async function updatePaymentInfo(id: string, input: ContactPaymentInfoUpdateInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const paymentInfo = await ContactPaymentInfo.findOne({ where: whereOrg(ctx, { id }), transaction: t })
    if (!paymentInfo) throw new Error('PAYMENT_INFO_NOT_FOUND')
    await assertParentContactMutable(paymentInfo.contact_id, ctx)

    if (input.is_default) {
      await ContactPaymentInfo.update(
        { is_default: false, updated_by: actorId },
        { where: whereOrg(ctx, { contact_id: paymentInfo.contact_id }), transaction: t }
      )
    }

    await paymentInfo.update({ ...input, updated_by: actorId }, { transaction: t })
    logger.info({ paymentInfoId: id, actorId }, 'payment info updated')
    return paymentInfo
  })
}

export async function deletePaymentInfo(id: string, ctx: TenantContext, actorId: string) {
  const paymentInfo = await ContactPaymentInfo.findOne({ where: whereOrg(ctx, { id }) })
  if (!paymentInfo) throw new Error('PAYMENT_INFO_NOT_FOUND')
  await assertParentContactMutable(paymentInfo.contact_id, ctx)
  await paymentInfo.update({ deleted_by: actorId })
  await paymentInfo.destroy()
  logger.info({ paymentInfoId: id, actorId }, 'payment info deleted')
}
