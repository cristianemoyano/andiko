import { Badge, type BadgeProps } from '@/components/primitives/Badge'
import type { OrderStatus } from '@/modules/sales/sales-order.model'
import { ORDER_STATUS_LABEL } from '@/modules/printing/labels'

const STATUS_VARIANT: Record<OrderStatus, BadgeProps['status']> = {
  draft:            'draft',
  confirmed:        'info',
  in_progress:      'pending',
  delivered:        'success',
  partial_returned: 'pending',
  returned:         'error',
  cancelled:        'error',
}

export interface OrderStatusBadgeProps {
  status: OrderStatus | string
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const key = status as OrderStatus
  const variant = STATUS_VARIANT[key] ?? 'neutral'
  const label = ORDER_STATUS_LABEL[key as OrderStatus] ?? status

  return (
    <Badge status={variant} dot className={className}>
      {label}
    </Badge>
  )
}
