'use client'

import Link from 'next/link'
import { Button } from '@/components/primitives/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/primitives/DropdownMenu'
import { cn } from '@/lib/utils'

export type PageAction = {
  id: string
  label: string
  onClick?: () => void
  href?: string
  openInNewTab?: boolean
  disabled?: boolean
  hidden?: boolean
  variant?: 'default' | 'destructive'
}

export type PageActionBarEditProps = {
  onCancel: () => void
  onSave: () => void
  saving?: boolean
  saveLabel?: string
  savingLabel?: string
  cancelLabel?: string
}

export type PageActionBarProps = {
  primary?: PageAction | null
  secondary?: PageAction[]
  /** Extra items rendered inside the dropdown (e.g. SendDocumentEmail as menu item). */
  menuChildren?: React.ReactNode
  className?: string
  edit?: PageActionBarEditProps
}

function visibleActions(actions: PageAction[] | undefined): PageAction[] {
  return (actions ?? []).filter(a => !a.hidden)
}

function ActionMenuItem({ action }: { action: PageAction }) {
  if (action.href) {
    return (
      <DropdownMenuItem asChild disabled={action.disabled} variant={action.variant === 'destructive' ? 'destructive' : 'default'}>
        <Link
          href={action.href}
          target={action.openInNewTab ? '_blank' : undefined}
          rel={action.openInNewTab ? 'noopener noreferrer' : undefined}
        >
          {action.label}
        </Link>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem
      variant={action.variant === 'destructive' ? 'destructive' : 'default'}
      disabled={action.disabled}
      onSelect={() => action.onClick?.()}
    >
      {action.label}
    </DropdownMenuItem>
  )
}

function PrimaryButton({ action }: { action: PageAction }) {
  if (action.href) {
    return (
      <Button asChild size="sm" disabled={action.disabled}>
        <Link
          href={action.href}
          target={action.openInNewTab ? '_blank' : undefined}
          rel={action.openInNewTab ? 'noopener noreferrer' : undefined}
        >
          {action.label}
        </Link>
      </Button>
    )
  }

  return (
    <Button size="sm" disabled={action.disabled} onClick={action.onClick}>
      {action.label}
    </Button>
  )
}

/**
 * Top-bar action layout: one primary button plus secondary actions in a dropdown.
 * Use `edit` for save/cancel while editing forms.
 */
export function PageActionBar({ primary, secondary, menuChildren, className, edit }: PageActionBarProps) {
  if (edit) {
    return (
      <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
        <Button size="sm" variant="secondary" onClick={edit.onCancel} disabled={edit.saving}>
          {edit.cancelLabel ?? 'Cancelar'}
        </Button>
        <Button size="sm" onClick={edit.onSave} disabled={edit.saving}>
          {edit.saving ? (edit.savingLabel ?? 'Guardando…') : (edit.saveLabel ?? 'Guardar cambios')}
        </Button>
      </div>
    )
  }

  const secondaryVisible = visibleActions(secondary)
  const defaultSecondary = secondaryVisible.filter(a => a.variant !== 'destructive')
  const destructiveSecondary = secondaryVisible.filter(a => a.variant === 'destructive')
  const hasMenu = defaultSecondary.length > 0 || destructiveSecondary.length > 0 || !!menuChildren
  const showPrimary = primary && !primary.hidden

  if (!showPrimary && !hasMenu) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      {showPrimary && primary ? <PrimaryButton action={primary} /> : null}

      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant={showPrimary ? 'secondary' : 'secondary'} aria-label="Más acciones">
              {showPrimary ? 'Más acciones' : 'Acciones'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {defaultSecondary.map(action => (
              <ActionMenuItem key={action.id} action={action} />
            ))}
            {menuChildren}
            {destructiveSecondary.length > 0 && (defaultSecondary.length > 0 || menuChildren) ? (
              <DropdownMenuSeparator />
            ) : null}
            {destructiveSecondary.map(action => (
              <ActionMenuItem key={action.id} action={action} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
