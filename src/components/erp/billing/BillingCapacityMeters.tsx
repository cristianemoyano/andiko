'use client'

interface CapacityRowProps {
  label: string
  used: number
  included: number
  contracted?: number
}

function CapacityRow({ label, used, included, contracted }: CapacityRowProps) {
  const baseline = Math.max(included, contracted ?? 0, used, 1)
  const usedPct = Math.min(100, (used / baseline) * 100)
  const includedPct = Math.min(100, (included / baseline) * 100)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-medium text-fg">{label}</span>
        <span className="tabular-nums text-fg-muted shrink-0">
          {used} activos · {included} incluidos
          {contracted !== undefined && contracted > included && (
            <> · {contracted} en contrato</>
          )}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-surface-hover overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-accent-border/80"
          style={{ width: `${includedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-chart"
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  )
}

interface BillingCapacityMetersProps {
  activeUsers: number
  contractedSeats: number
  includedSeats: number
  activeBranches: number
  includedBranches: number
}

export function BillingCapacityMeters({
  activeUsers,
  contractedSeats,
  includedSeats,
  activeBranches,
  includedBranches,
}: BillingCapacityMetersProps) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <CapacityRow
        label="Usuarios"
        used={activeUsers}
        included={includedSeats}
        contracted={contractedSeats}
      />
      <CapacityRow
        label="Sucursales"
        used={activeBranches}
        included={includedBranches}
      />
      <p className="text-[11px] text-fg-subtle">
        La barra clara marca lo incluido en el plan; la barra de color, el uso actual.
      </p>
    </div>
  )
}
