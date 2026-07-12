import 'server-only'
import Contact from './contact.model'

export interface ContactDisplay {
  email: string | null
  name: string
}

/**
 * Resolves a contact's display name/email for use in emails. Falls back to
 * `fallbackName` when the contact is unset or not found (e.g. "Cliente" for
 * sales documents, "Proveedor" for purchase orders).
 */
export async function resolveContactDisplay(
  contactId: string | null,
  orgId: string,
  fallbackName = 'Cliente',
): Promise<ContactDisplay> {
  if (!contactId) return { email: null, name: fallbackName }
  const contact = await Contact.findOne({
    where: { id: contactId, org_id: orgId },
    attributes: ['id', 'legal_name', 'trade_name', 'email'],
  })
  if (!contact) return { email: null, name: fallbackName }
  return { email: contact.email ?? null, name: contact.trade_name || contact.legal_name }
}
