// Catálogo de servicios extra facturables por plan (no son módulos ERP).
// Client-safe: sin imports server-only.

export const BILLING_EXTRA_KEYS = [
  'training',
  'whatsapp_support',
  'backup',
] as const

export type BillingExtraKey = typeof BILLING_EXTRA_KEYS[number]

export interface BillingExtraDef {
  key: BillingExtraKey
  label: string
  description: string
}

export const BILLING_EXTRA_DEFS: BillingExtraDef[] = [
  {
    key: 'training',
    label: 'Capacitación',
    description: 'Sesiones de onboarding y capacitación para el equipo',
  },
  {
    key: 'whatsapp_support',
    label: 'Soporte por WhatsApp',
    description: 'Atención prioritaria por WhatsApp en horario comercial',
  },
  {
    key: 'backup',
    label: 'Backup extendido',
    description: 'Respaldo diario con retención extendida y restauración asistida',
  },
]

export function billingExtraLabel(key: string): string {
  return BILLING_EXTRA_DEFS.find(d => d.key === key)?.label ?? key
}

export function isBillingExtraKey(value: string): value is BillingExtraKey {
  return (BILLING_EXTRA_KEYS as readonly string[]).includes(value)
}
