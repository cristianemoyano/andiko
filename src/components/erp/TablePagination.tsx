'use client'

import { Button } from '@/components/primitives/Button'
import { cn } from '@/lib/utils'

export interface TablePaginationProps {
  /** Página actual (base 1). */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (total <= 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <nav
      className={cn('flex items-center gap-3', className)}
      aria-label="Paginación de tabla"
    >
      <Button
        type="button"
        variant="secondary"
        size="xs"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
      >
        ← Anterior
      </Button>
      <span className="text-[12px] text-zinc-500 tabular-nums">
        Pág. {page} de {totalPages}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente →
      </Button>
    </nav>
  )
}
