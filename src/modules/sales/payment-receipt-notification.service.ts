import 'server-only'
import type { TenantContext } from '@/lib/tenancy'
import Payment from './payment.model'
import Invoice from './invoice.model'
import Organization from '@/modules/auth/organization.model'
import { resolveContactDisplay } from '@/modules/contacts/contact-lookup.service'
import { formatArs } from '@/lib/money-format'
import { absoluteUrl } from '@/lib/absolute-url'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { paymentReceiptPayloadSchema } from '@/modules/notifications/notification.schema'

function formatDateEsAr(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

/**
 * Sends the "recibo de pago" email for a just-registered payment, unless the
 * org has that template disabled. Must only be called AFTER the payment's own
 * transaction has committed — never pass a shared transaction through here,
 * and callers must catch failures instead of letting them fail the payment.
 */
export async function sendPaymentReceiptEmail(
  payment: Payment,
  ctx: TenantContext,
  actorId: string | null,
): Promise<void> {
  const templates = await getEffectiveEmailTemplates(ctx.orgId)
  if (!templates.payment_receipt.enabled) return

  const invoice = await Invoice.findOne({ where: { id: payment.invoice_id, org_id: ctx.orgId } })
  if (!invoice) throw new Error('INVOICE_NOT_FOUND')

  const contact = await resolveContactDisplay(payment.contact_id, ctx.orgId, 'Cliente')
  if (!contact.email) throw new Error('NO_RECIPIENT_EMAIL')

  const organization = await Organization.findByPk(ctx.orgId, { attributes: ['name'] })

  const payload = paymentReceiptPayloadSchema.parse({
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    payment_id: payment.id,
    payment_number: payment.payment_number,
    contact_name: contact.name,
    org_name: organization?.name ?? 'Andiko',
    amount: formatArs(payment.amount),
    payment_date: formatDateEsAr(payment.payment_date),
    document_url: absoluteUrl(`/ventas/facturas/${invoice.id}/print`),
  })

  await emitNotification(
    {
      eventKey: 'sales.payment_receipt',
      recipient: { kind: 'email', address: contact.email },
      payload,
      channels: ['email'],
    },
    { orgId: ctx.orgId, actorId },
  )
}
