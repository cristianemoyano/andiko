import { Badge, type BadgeProps } from '@/components/primitives/Badge'
import { SHIPMENT_STATUS_LABEL, type ShipmentStatus } from '@/modules/logistics/logistics.constants'

const STATUS_VARIANT: Record<ShipmentStatus, BadgeProps['status']> = {
  pending:          'draft',
  ready_to_ship:    'pending',
  dispatched:       'info',
  in_transit:       'info',
  out_for_delivery: 'info',
  delivered:        'success',
  failed:           'error',
  returned:         'pending',
  cancelled:        'error',
}

export interface ShipmentStatusBadgeProps {
  status: ShipmentStatus
  className?: string
}

export function ShipmentStatusBadge({ status, className }: ShipmentStatusBadgeProps) {
  return (
    <Badge status={STATUS_VARIANT[status]} dot className={className}>
      {SHIPMENT_STATUS_LABEL[status]}
    </Badge>
  )
}
