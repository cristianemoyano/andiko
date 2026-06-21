import { Badge, type BadgeProps } from '@/components/primitives/Badge'

/** AFIP per-document transmission status (mirrors the API `afip_status` field). */
export type AfipDocStatus = 'not_sent' | 'pending' | 'authorized' | 'rejected' | 'contingency'

export const AFIP_DOC_STATUS_LABEL: Record<AfipDocStatus, string> = {
  not_sent: 'No enviado',
  pending: 'Pendiente',
  authorized: 'Autorizado',
  rejected: 'Rechazado',
  contingency: 'Contingencia',
}

const STATUS_BADGE: Record<AfipDocStatus, BadgeProps['status']> = {
  not_sent: 'neutral',
  pending: 'pending',
  authorized: 'success',
  rejected: 'error',
  contingency: 'pending',
}

export interface AfipStatusBadgeProps {
  status: AfipDocStatus
  className?: string
}

/** Badge that renders an AFIP document status with its Spanish label and color. */
export function AfipStatusBadge({ status, className }: AfipStatusBadgeProps) {
  return (
    <Badge status={STATUS_BADGE[status]} dot className={className}>
      {AFIP_DOC_STATUS_LABEL[status]}
    </Badge>
  )
}
