import 'server-only'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import { paginate } from '@/lib/pagination'
import { whereOrg } from '@/lib/tenancy'
import Contact from '@/modules/contacts/contact.model'
import ContactAddress from '@/modules/contacts/contact-address.model'
import { createContact } from '@/modules/contacts/contacts.service'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceCustomerLink from './woocommerce-customer-link.model'
import { buildClientForSite } from './woo-sites.service'
import type { WooAddress, WooCustomer } from './woo-client'
import {
  customerImportPreviewCacheKey,
  getCustomerImportPreviewSnapshot,
  invalidateCustomerImportPreviewSnapshot,
  setCustomerImportPreviewSnapshot,
  type CustomerImportPreviewItem,
  type CustomerImportPreviewSnapshot,
} from './woo-import-preview.cache'
import type {
  WoocommerceCustomerImportPreviewInput,
} from './woocommerce.schema'
import {
  classifyCustomersForPreview,
  customerDisplayName,
  customerEmail,
  activeLinkedWooCustomerIds,
} from './woo-customers.utils'

export { customerEmail } from './woo-customers.utils'
export { resolveLiveContactForCustomerLink } from './woo-sync-links.service'
import { resolveLiveContactForCustomerLink } from './woo-sync-links.service'
import {
  WOO_IMPORT_SOURCE,
  resolveWooCustomerLegalName,
  resolveWooCustomerPhone,
  wooCustomerAddressInputs,
  wooExternalCustomerId,
} from './woo-address.utils'

function actorFor(site: WoocommerceSite): string {
  return site.created_by ?? site.org_id!
}

function tenantCtx(site: WoocommerceSite) {
  return {
    orgId: site.org_id!,
    userId: actorFor(site),
    defaultBranchId: site.branch_id,
    allowedBranchIds: [site.branch_id],
  }
}

function wooAddressFromContact(contact: Contact): WooAddress {
  const firstName = contact.first_name?.trim() || contact.legal_name.split(/\s+/)[0] || contact.legal_name
  const lastName = contact.last_name?.trim() || contact.legal_name.split(/\s+/).slice(1).join(' ') || ''
  return {
    first_name: firstName,
    last_name: lastName,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    company: contact.trade_name && contact.trade_name !== contact.legal_name
      ? contact.legal_name
      : undefined,
  }
}

export function buildWooCustomerPayload(contact: Contact): Record<string, unknown> {
  const billing = wooAddressFromContact(contact)
  return {
    email: contact.email ?? undefined,
    first_name: billing.first_name,
    last_name: billing.last_name,
    billing,
    shipping: billing,
  }
}

/** Builds a Woo customer payload from order billing/shipping (guest or registered buyer). */
export function orderToWooCustomer(order: { id: number; customer_id?: number; billing?: WooAddress; shipping?: WooAddress }): WooCustomer {
  return {
    id: order.customer_id && order.customer_id > 0 ? order.customer_id : 0,
    email: order.billing?.email,
    first_name: order.billing?.first_name,
    last_name: order.billing?.last_name,
    billing: order.billing,
    shipping: order.shipping,
  }
}

async function findContactByEmail(orgId: string, email: string, t?: Transaction) {
  return Contact.findOne({
    where: {
      org_id: orgId,
      email: { [Op.iLike]: email },
    },
    transaction: t,
  })
}

async function syncContactAddressesFromWoo(
  contactId: string,
  billing: WooAddress | undefined,
  shipping: WooAddress | undefined,
  site: WoocommerceSite,
  t?: Transaction,
) {
  const inputs = wooCustomerAddressInputs(billing, shipping)
  if (inputs.length === 0) return

  const actor = actorFor(site)
  const ctx = tenantCtx(site)

  for (const input of inputs) {
    const existing = await ContactAddress.findOne({
      where: whereOrg(ctx, { contact_id: contactId, type: input.type }),
      transaction: t,
      order: [['is_default', 'DESC'], ['created_at', 'ASC']],
    })

    if (existing) {
      await existing.update({ ...input, updated_by: actor }, { transaction: t })
    } else {
      await ContactAddress.create({
        ...input,
        contact_id: contactId,
        org_id: site.org_id!,
        created_by: actor,
        updated_by: actor,
      }, { transaction: t })
    }
  }
}

/** Applies Woo billing/shipping + identity fields onto an existing ERP contact. */
export async function syncWooCustomerToContact(
  contact: Contact,
  customer: WooCustomer,
  site: WoocommerceSite,
  t?: Transaction,
): Promise<void> {
  const billing = customer.billing
  const shipping = customer.shipping
  const displayName = customerDisplayName(customer)
  const legalName = resolveWooCustomerLegalName(customer, displayName)
  const company = billing?.company?.trim() || shipping?.company?.trim()
  const personName = [billing?.first_name, billing?.last_name].filter(Boolean).join(' ').trim()
  const phone = resolveWooCustomerPhone(customer)
  const email = billing?.email?.trim() || customer.email?.trim() || customerEmail(customer)

  await contact.update({
    legal_name: legalName,
    first_name: billing?.first_name ?? customer.first_name ?? contact.first_name,
    last_name: billing?.last_name ?? customer.last_name ?? contact.last_name,
    email: email ?? contact.email,
    phone: phone ?? contact.phone,
    trade_name: company && legalName === company && personName ? personName : contact.trade_name,
    import_source: WOO_IMPORT_SOURCE,
    import_external_id: customer.id > 0 ? wooExternalCustomerId(customer.id) : contact.import_external_id,
    updated_by: actorFor(site),
  }, { transaction: t })

  await syncContactAddressesFromWoo(contact.id, billing, shipping, site, t)
}

async function touchCustomerLink(link: WoocommerceCustomerLink, t?: Transaction) {
  await link.update({ last_synced_at: new Date() }, { transaction: t })
}

async function loadWooCustomerForSync(site: WoocommerceSite, customer: WooCustomer): Promise<WooCustomer> {
  if (customer.id <= 0) return customer
  const client = buildClientForSite(site)
  return client.getCustomer(customer.id)
}

export async function upsertContactFromWooCustomer(
  site: WoocommerceSite,
  customer: WooCustomer,
  t?: Transaction,
): Promise<{ contactId: string; created: boolean; linked: boolean; synced: boolean }> {
  if (customer.id > 0) {
    customer = await loadWooCustomerForSync(site, customer)
  }

  const email = customerEmail(customer)
  if (!email) throw new Error('CUSTOMER_WITHOUT_EMAIL')

  const wooId = customer.id > 0 ? String(customer.id) : null

  if (wooId) {
    const existingLink = await WoocommerceCustomerLink.findOne({
      where: { site_id: site.id, woo_customer_id: wooId },
      transaction: t,
    })
    if (existingLink) {
      const contact = await resolveLiveContactForCustomerLink(site, existingLink, t)
      if (contact) {
        await syncWooCustomerToContact(contact, customer, site, t)
        await touchCustomerLink(existingLink, t)
        return { contactId: contact.id, created: false, linked: false, synced: true }
      }
    }
  }

  const billing = customer.billing
  const legalName = resolveWooCustomerLegalName(customer, customerDisplayName(customer))
  const phone = resolveWooCustomerPhone(customer)
  const company = billing?.company?.trim() || customer.shipping?.company?.trim()
  const personName = [billing?.first_name, billing?.last_name].filter(Boolean).join(' ').trim()

  const matched = await findContactByEmail(site.org_id!, email, t)
  if (matched) {
    await syncWooCustomerToContact(matched, customer, site, t)
    if (wooId) {
      const [link] = await WoocommerceCustomerLink.findOrCreate({
        where: { site_id: site.id, woo_customer_id: wooId },
        defaults: {
          org_id: site.org_id!,
          site_id: site.id,
          woo_customer_id: wooId,
          contact_id: matched.id,
          last_synced_at: new Date(),
        },
        transaction: t,
      })
      await touchCustomerLink(link, t)
    }
    return { contactId: matched.id, created: false, linked: true, synced: true }
  }

  const contact = await createContact(
    {
      type: 'customer',
      legal_name: legalName,
      trade_name: company && legalName === company && personName ? personName : null,
      first_name: billing?.first_name ?? customer.first_name ?? null,
      last_name: billing?.last_name ?? customer.last_name ?? null,
      iva_condition: 'consumidor_final',
      email: billing?.email?.trim() || customer.email?.trim() || email,
      phone,
    },
    tenantCtx(site),
    actorFor(site),
  )

  await contact.update({
    import_source: wooId ? WOO_IMPORT_SOURCE : null,
    import_external_id: wooId ? wooExternalCustomerId(customer.id) : null,
    updated_by: actorFor(site),
  }, { transaction: t })

  await syncContactAddressesFromWoo(contact.id, billing, customer.shipping, site, t)

  if (wooId) {
    await WoocommerceCustomerLink.create(
      {
        org_id: site.org_id!,
        site_id: site.id,
        woo_customer_id: wooId,
        contact_id: contact.id,
        last_synced_at: new Date(),
      },
      { transaction: t },
    )
  }

  return { contactId: contact.id, created: true, linked: Boolean(wooId), synced: true }
}

async function buildCustomerImportPreviewSnapshot(site: WoocommerceSite): Promise<CustomerImportPreviewSnapshot> {
  const client = buildClientForSite(site)
  const customers = await client.listCustomers()

  const linkedIds = new Set<string>()
  const links = await WoocommerceCustomerLink.findAll({
    where: { site_id: site.id },
    attributes: ['woo_customer_id', 'contact_id'],
  })

  if (links.length > 0) {
    const liveContacts = await Contact.findAll({
      where: {
        org_id: site.org_id,
        id: { [Op.in]: links.map((link) => link.contact_id) },
      },
      attributes: ['id'],
    })
    const liveContactIds = new Set(liveContacts.map((contact) => contact.id))
    for (const id of activeLinkedWooCustomerIds(links, liveContactIds)) {
      linkedIds.add(id)
    }
  }

  const erpEmails = new Set<string>()
  const contacts = await Contact.findAll({
    where: {
      org_id: site.org_id,
      email: { [Op.ne]: null },
    },
    attributes: ['email'],
  })
  for (const contact of contacts) {
    if (contact.email) erpEmails.add(contact.email.toLowerCase())
  }

  return classifyCustomersForPreview(customers, linkedIds, erpEmails)
}

export interface CustomerImportPreview {
  woo_total: number
  to_import_count: number
  matched_by_email_count: number
  already_linked_count: number
  skipped_count: number
  section: WoocommerceCustomerImportPreviewInput['section']
  items: CustomerImportPreviewItem[]
  page: number
  limit: number
  total: number
  pages: number
}

export async function previewCustomerImport(
  site: WoocommerceSite,
  opts: WoocommerceCustomerImportPreviewInput,
): Promise<CustomerImportPreview> {
  const cacheKey = customerImportPreviewCacheKey(site.org_id!, site.id)
  if (opts.refresh) invalidateCustomerImportPreviewSnapshot(cacheKey)

  let snapshot = getCustomerImportPreviewSnapshot(cacheKey)
  if (!snapshot) {
    snapshot = await buildCustomerImportPreviewSnapshot(site)
    setCustomerImportPreviewSnapshot(cacheKey, snapshot)
  }

  const sectionItems = snapshot[opts.section]
  const total = sectionItems.length
  const { offset, limit } = paginate(opts.page, opts.limit)
  const items = sectionItems.slice(offset, offset + limit)

  return {
    woo_total: snapshot.woo_total,
    to_import_count: snapshot.to_import.length,
    matched_by_email_count: snapshot.matched_by_email.length,
    already_linked_count: snapshot.already_linked.length,
    skipped_count: snapshot.skipped.length,
    section: opts.section,
    items,
    page: opts.page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / opts.limit)),
  }
}

export interface CustomerImportResult {
  contacts_created: number
  contacts_linked: number
  already_linked: number
  synced: number
  skipped: number
}

/** Imports WooCommerce customers into the ERP. Idempotent — safe to re-run. */
export async function applyCustomerImport(site: WoocommerceSite): Promise<CustomerImportResult> {
  invalidateCustomerImportPreviewSnapshot(customerImportPreviewCacheKey(site.org_id!, site.id))

  const client = buildClientForSite(site)
  const customers = await client.listCustomers()

  let contactsCreated = 0
  let contactsLinked = 0
  let alreadyLinked = 0
  let synced = 0
  let skipped = 0

  for (const customer of customers) {
    if (!customerEmail(customer)) {
      skipped += 1
      continue
    }

    try {
      const result = await upsertContactFromWooCustomer(site, customer)
      if (result.created) contactsCreated += 1
      else if (result.linked) contactsLinked += 1
      else alreadyLinked += 1
      if (result.synced) synced += 1
    } catch (err) {
      logger.warn({ siteId: site.id, wooCustomerId: customer.id, err: String(err) }, 'woocommerce customer import skipped')
      skipped += 1
    }
  }

  logger.info(
    { siteId: site.id, contactsCreated, contactsLinked, alreadyLinked, synced, skipped },
    'woocommerce customer import applied',
  )

  return {
    contacts_created: contactsCreated,
    contacts_linked: contactsLinked,
    already_linked: alreadyLinked,
    synced,
    skipped,
  }
}

/** Pushes one linked ERP contact to WooCommerce (create or update). */
export async function pushContactToWoo(site: WoocommerceSite, contactId: string): Promise<'created' | 'updated' | 'skipped'> {
  const contact = await Contact.findOne({
    where: { id: contactId, org_id: site.org_id },
  })
  if (!contact?.email?.trim()) return 'skipped'

  const payload = buildWooCustomerPayload(contact)
  const client = buildClientForSite(site)
  const link = await WoocommerceCustomerLink.findOne({
    where: { site_id: site.id, contact_id: contactId },
  })

  if (link) {
    await client.updateCustomer(Number(link.woo_customer_id), payload)
    await link.update({ last_synced_at: new Date() })
    return 'updated'
  }

  const created = await client.createCustomer(payload)
  await WoocommerceCustomerLink.create({
    org_id: site.org_id!,
    site_id: site.id,
    woo_customer_id: String(created.id),
    contact_id: contactId,
    last_synced_at: new Date(),
  })
  await contact.update({
    import_source: WOO_IMPORT_SOURCE,
    import_external_id: wooExternalCustomerId(created.id),
    updated_by: actorFor(site),
  })
  return 'created'
}

export interface PushCustomersResult {
  created: number
  updated: number
  skipped: number
}

/** Pushes all ERP customer contacts to WooCommerce for a site. */
export async function pushCustomersForSite(site: WoocommerceSite): Promise<PushCustomersResult> {
  const contacts = await Contact.findAll({
    where: {
      org_id: site.org_id,
      type: { [Op.in]: ['customer', 'both'] },
      email: { [Op.ne]: null },
    },
    attributes: ['id'],
    order: [['legal_name', 'ASC']],
  })

  let created = 0
  let updated = 0
  let skipped = 0

  for (const contact of contacts) {
    try {
      const result = await pushContactToWoo(site, contact.id)
      if (result === 'created') created += 1
      else if (result === 'updated') updated += 1
      else skipped += 1
    } catch (err) {
      logger.warn({ siteId: site.id, contactId: contact.id, err: String(err) }, 'woocommerce customer push failed')
      skipped += 1
    }
  }

  logger.info({ siteId: site.id, created, updated, skipped }, 'woocommerce customers pushed')
  return { created, updated, skipped }
}
