'use client'

import { Select } from '@/components/primitives/Select'
import { SearchableSelect } from '@/components/erp'
import { PanelCustomizeButton } from '@/components/erp/PanelCustomizeDialog'

export type PanelPeriod = 'last_week' | 'last_month' | 'last_3months' | 'last_year' | 'custom'

const PERIOD_OPTIONS: { value: PanelPeriod; label: string }[] = [
  { value: 'last_week', label: 'Última semana' },
  { value: 'last_month', label: 'Último mes' },
  { value: 'last_3months', label: 'Últimos 3 meses' },
  { value: 'last_year', label: 'Último año' },
  { value: 'custom', label: 'Personalizado…' },
]

interface PanelFilterBarProps {
  period: PanelPeriod
  branchId: string
  fromDate: string
  toDate: string
  branches: { value: string; label: string }[]
  onPeriodChange: (period: PanelPeriod) => void
  onBranchChange: (branchId: string) => void
  onFromChange: (from: string) => void
  onToChange: (to: string) => void
}

function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export function PanelFilterBar({
  period,
  branchId,
  fromDate,
  toDate,
  branches,
  onPeriodChange,
  onBranchChange,
  onFromChange,
  onToChange,
}: PanelFilterBarProps) {
  return (
    <div className="border-b border-border bg-surface px-4 md:px-6 py-3 shrink-0 print:hidden">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex flex-1 flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-2 min-w-0">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle">
                <IconCalendar />
              </span>
              <Select
                value={period}
                onChange={v => onPeriodChange(v as PanelPeriod)}
                options={PERIOD_OPTIONS}
                className="h-8 pl-8 text-[13px]"
              />
            </div>

            {branches.length > 0 && (
              <div className="min-w-0 flex-1 sm:max-w-xs">
                <SearchableSelect
                  options={branches}
                  value={branchId}
                  onChange={v => onBranchChange(v ?? 'all')}
                  placeholder="Sucursal"
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <PanelCustomizeButton />
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted/60 px-3 py-2">
            <label className="flex flex-1 flex-col gap-1 min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Desde</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => onFromChange(e.target.value)}
                className="h-8 w-full rounded-sm border border-border bg-surface px-2 text-[13px] text-fg focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-ring"
              />
            </label>
            <span className="mt-5 text-fg-subtle" aria-hidden="true">→</span>
            <label className="flex flex-1 flex-col gap-1 min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Hasta</span>
              <input
                type="date"
                value={toDate}
                onChange={e => onToChange(e.target.value)}
                className="h-8 w-full rounded-sm border border-border bg-surface px-2 text-[13px] text-fg focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

export { PERIOD_OPTIONS as PANEL_PERIOD_OPTIONS }
