import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import SalesQuote from './sales-quote.model'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import { whereSalesDocumentScope } from './sales-scope'

/** Quote statuses that are still "open" and can transition to `expired`. */
const EXPIRABLE_STATUSES = ['draft', 'sent'] as const

/** Hard cap on the number of quotes returned by `listQuotesExpiringSoon`. */
const MAX_EXPIRING_SOON = 100

/**
 * Daily job: marks `draft`/`sent` quotes as `expired` once `valid_until` has passed.
 * Global across all orgs (no tenant context) — mirrors billing dunning's shape.
 */
export async function expireOverdueQuotes(): Promise<{ expired_count: number }> {
  return sequelize.transaction(async (t) => {
    const where = {
      status: { [Op.in]: EXPIRABLE_STATUSES },
      valid_until: { [Op.lt]: new Date() },
      deleted_at: null,
    }

    const [expiredCount] = await SalesQuote.update(
      { status: 'expired' },
      { where, transaction: t },
    )

    if (expiredCount > 0) {
      logger.info({ count: expiredCount }, 'quotes marked expired')
    }

    return { expired_count: expiredCount }
  })
}

export type ExpiringSoonQuote = {
  id: string
  quote_number: string
  status: string
  valid_until: Date | null
  contact: { id: string; legal_name: string; trade_name: string | null } | null
  branch: { id: string; name: string; branch_code: string } | null
  total: string
}

/**
 * Lists `draft`/`sent` quotes whose `valid_until` falls within the next `days`
 * days (org/branch scoped). Used to drive "about to expire" follow-up.
 */
export async function listQuotesExpiringSoon(days: number, ctx: TenantContext): Promise<ExpiringSoonQuote[]> {
  const now = new Date()
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const quotes = await SalesQuote.findAll({
    where: whereSalesDocumentScope(ctx, {
      status: { [Op.in]: EXPIRABLE_STATUSES },
      valid_until: { [Op.between]: [now, until] },
    }),
    attributes: ['id', 'quote_number', 'status', 'valid_until', 'total'],
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'] },
    ],
    order: [['valid_until', 'ASC']],
    limit: MAX_EXPIRING_SOON,
  })

  return quotes.map((quote) => {
    const plain = quote.get({ plain: true }) as unknown as {
      id: string
      quote_number: string
      status: string
      valid_until: Date | null
      total: string
      contact: { id: string; legal_name: string; trade_name: string | null } | null
      branch: { id: string; name: string; branch_code: string } | null
    }
    return {
      id: plain.id,
      quote_number: plain.quote_number,
      status: plain.status,
      valid_until: plain.valid_until,
      contact: plain.contact,
      branch: plain.branch,
      total: plain.total,
    }
  })
}
