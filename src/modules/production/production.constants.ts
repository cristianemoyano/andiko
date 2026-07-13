export const PRODUCTION_ORDER_STATUSES = ['draft', 'released', 'in_process', 'done', 'cancelled'] as const
export type ProductionOrderStatus = typeof PRODUCTION_ORDER_STATUSES[number]
