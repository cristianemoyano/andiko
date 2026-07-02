import { cn } from '@/lib/utils'

type DocType = 'quote' | 'order' | 'invoice'

interface Step {
  value: string
  label: string
}

const PIPELINES: Record<DocType, Step[]> = {
  quote: [
    { value: 'draft',    label: 'Borrador' },
    { value: 'sent',     label: 'Enviado' },
    { value: 'accepted', label: 'Aceptado' },
  ],
  order: [
    { value: 'draft',       label: 'Borrador' },
    { value: 'confirmed',   label: 'Confirmado' },
    { value: 'in_progress', label: 'En preparación' },
    { value: 'delivered',   label: 'Entregado' },
  ],
  invoice: [
    { value: 'draft',          label: 'Borrador' },
    { value: 'issued',         label: 'Emitida' },
    { value: 'partially_paid', label: 'Pago parcial' },
    { value: 'paid',           label: 'Pagada' },
  ],
}

const NEGATIVE: Partial<Record<string, { label: string; variant: 'red' | 'amber' }>> = {
  rejected:         { label: 'Rechazado', variant: 'red' },
  expired:          { label: 'Vencido',   variant: 'amber' },
  cancelled:        { label: 'Cancelado', variant: 'red' },
  partial_returned: { label: 'Devolución parcial', variant: 'amber' },
  returned:         { label: 'Devuelto', variant: 'amber' },
}

export interface StatusPipelineProps {
  type: DocType
  status: string
  className?: string
}

export function StatusPipeline({ type, status, className }: StatusPipelineProps) {
  const steps = PIPELINES[type]
  const neg = NEGATIVE[status]

  if (neg) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <span className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium border',
          neg.variant === 'red'   && 'bg-danger-bg text-danger border-danger',
          neg.variant === 'amber' && 'bg-warning-bg text-warning border-warning',
        )}>
          {neg.label}
        </span>
      </div>
    )
  }

  const currentIndex = steps.findIndex(s => s.value === status)

  return (
    <div className={cn('flex items-start', className)}>
      {steps.map((step, idx) => {
        const isDone   = idx < currentIndex
        const isActive = idx === currentIndex
        return (
          <div key={step.value} className="flex items-start">
            {idx > 0 && (
              <div className={cn(
                'mt-3 h-px w-8 flex-shrink-0',
                isDone ? 'bg-brand-600' : 'bg-border-strong',
              )} />
            )}
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold border-2 transition-colors flex-shrink-0',
                isDone   && 'bg-brand-600 border-brand-600 text-white',
                isActive && 'bg-surface border-brand-600 text-brand-600',
                !isDone && !isActive && 'bg-surface border-border-strong text-fg-subtle',
              )}>
                {isDone ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6.5l3 3 5-5" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span className={cn(
                'text-[10px] whitespace-nowrap leading-tight',
                isActive ? 'text-brand-600 font-semibold' : '',
                isDone   ? 'text-fg-muted' : '',
                !isDone && !isActive ? 'text-fg-subtle' : '',
              )}>
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
