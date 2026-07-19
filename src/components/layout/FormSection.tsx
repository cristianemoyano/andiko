import { cn } from '@/lib/utils'

export interface FormSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Título de sección (14px seminegrita). Omitir para una sección sin encabezado. */
  title?: React.ReactNode
  /** Texto de ayuda opcional debajo del título. */
  description?: React.ReactNode
  children: React.ReactNode
}

/**
 * Tarjeta de sección para formularios ERP: fondo de superficie, borde, esquina
 * suave y sombra sutil. Unifica el armado de las pantallas de alta (presupuestos,
 * pedidos, devoluciones, etc.) en un solo lugar.
 */
export function FormSection({ title, description, children, className, ...props }: FormSectionProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-md border border-border bg-surface p-5',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
        className,
      )}
      {...props}
    >
      {(title || description) && (
        <div className="flex flex-col gap-0.5">
          {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
          {description && <p className="text-[13px] text-fg-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  )
}
