// No `server-only` — imported from tenancy-admin and tsx-run seed scripts.
import type { Transaction } from 'sequelize'
import Contact from './contact.model'

export const SYSTEM_KEY_CONSUMIDOR_FINAL = 'consumidor_final' as const
export const CONSUMIDOR_FINAL_LEGAL_NAME = 'Consumidor Final'

/**
 * Idempotent seed of the protected "Consumidor Final" system contact for an org.
 * Promotes a matching existing row when possible; otherwise creates one.
 * Returns the contact (existing or newly created).
 */
export async function seedConsumidorFinalContact(
  orgId: string,
  t: Transaction,
  actorId: string | null = null,
): Promise<Contact> {
  const existing = await Contact.findOne({
    where: { org_id: orgId, system_key: SYSTEM_KEY_CONSUMIDOR_FINAL },
    transaction: t,
  })
  if (existing) return existing

  const candidate = await Contact.findOne({
    where: {
      org_id: orgId,
      type: 'customer',
      iva_condition: 'consumidor_final',
      cuit: null,
      legal_name: CONSUMIDOR_FINAL_LEGAL_NAME,
      is_system: false,
    },
    order: [['created_at', 'ASC']],
    transaction: t,
  })
  if (candidate) {
    await candidate.update(
      {
        is_system: true,
        system_key: SYSTEM_KEY_CONSUMIDOR_FINAL,
        is_active: true,
        updated_by: actorId,
      },
      { transaction: t },
    )
    return candidate
  }

  return Contact.create(
    {
      org_id: orgId,
      type: 'customer',
      legal_name: CONSUMIDOR_FINAL_LEGAL_NAME,
      trade_name: null,
      cuit: null,
      iva_condition: 'consumidor_final',
      is_active: true,
      is_system: true,
      system_key: SYSTEM_KEY_CONSUMIDOR_FINAL,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction: t },
  )
}

export async function getConsumidorFinalContact(
  orgId: string,
  t?: Transaction,
): Promise<Contact | null> {
  return Contact.findOne({
    where: { org_id: orgId, system_key: SYSTEM_KEY_CONSUMIDOR_FINAL },
    ...(t ? { transaction: t } : {}),
  })
}

export function assertContactMutable(contact: Contact): void {
  if (!contact.is_system) return
  throw new Error('SYSTEM_CONTACT_NOT_EDITABLE')
}

export function assertContactDeletable(contact: Contact): void {
  if (!contact.is_system) return
  throw new Error('SYSTEM_CONTACT_NOT_DELETABLE')
}
