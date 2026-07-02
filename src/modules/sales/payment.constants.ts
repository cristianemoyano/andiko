/** Métodos de cobro de ventas — sin dependencias de servidor (safe para schemas y UI). */
export const PAYMENT_METHODS = ['cash', 'transfer', 'check', 'card', 'other'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]
