import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  value: string
  tone?: 'default' | 'danger' | 'warning'
}

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3 min-w-[120px]">
      <div className="text-[12px] text-fg-muted">{label}</div>
      <div
        className={cn(
          'text-[20px] font-semibold tabular-nums',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
          tone === 'default' && 'text-fg',
        )}
      >
        {value}
      </div>
    </div>
  )
}
