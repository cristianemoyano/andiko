'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/primitives/Button'
import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { cn } from '@/lib/utils'

export interface StatusPageAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export interface StatusPageProps {
  code: string
  title: string
  description: string
  primaryAction: StatusPageAction
  secondaryAction?: StatusPageAction
  showLogo?: boolean
  className?: string
}

export function StatusPage({
  code,
  title,
  description,
  primaryAction,
  secondaryAction,
  showLogo = false,
  className,
}: StatusPageProps) {
  const router = useRouter()

  function renderAction(action: StatusPageAction, fallbackVariant: 'primary' | 'secondary') {
    const variant = action.variant ?? fallbackVariant

    if (action.onClick) {
      return (
        <Button type="button" variant={variant} size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )
    }

    if (action.href) {
      return (
        <Button asChild variant={variant} size="sm">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )
    }

    return (
      <Button type="button" variant={variant} size="sm" onClick={() => router.back()}>
        {action.label}
      </Button>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24', className)}>
      {showLogo && (
        <div className="mb-8">
          <AndikoLogo href="/" size="md" />
        </div>
      )}

      <p className="font-mono text-[56px] sm:text-[72px] font-semibold leading-none tracking-tight text-fg-subtle/80">
        {code}
      </p>
      <h1 className="mt-4 text-[20px] sm:text-[22px] font-semibold text-fg">{title}</h1>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-fg-muted">{description}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {renderAction(primaryAction, 'primary')}
        {secondaryAction && renderAction(secondaryAction, 'secondary')}
      </div>
    </div>
  )
}
