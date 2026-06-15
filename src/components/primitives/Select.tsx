'use client'
import { forwardRef } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value?: string | null
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  error?: boolean
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  className?: string
}

/**
 * Select liviano para listas estáticas y cortas (estados, condición IVA, etc.).
 * Para búsqueda asíncrona o listas largas usar `erp/SearchableSelect`.
 *
 * Radix reserva '' para limpiar la selección — opciones con value '' se mapean
 * internamente a un sentinel y se devuelven como '' en onChange.
 */
const EMPTY_OPTION_VALUE = '__select_empty__'

const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    { value, onChange, options, placeholder = 'Seleccionar…', error, disabled, required, id, name, className },
    ref,
  ) => (
    <RadixSelect.Root
      value={value === '' ? EMPTY_OPTION_VALUE : (value ?? undefined)}
      onValueChange={(v) => onChange(v === EMPTY_OPTION_VALUE ? '' : v)}
      disabled={disabled}
      required={required}
      name={name}
    >
      <RadixSelect.Trigger
        ref={ref}
        id={id}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-sm border bg-surface px-2.5 text-[13px] text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-fg-subtle',
          'data-[placeholder]:text-fg-subtle',
          error
            ? 'border-danger focus-visible:ring-red-200 text-danger'
            : 'border-border-strong focus-visible:ring-ring focus-visible:border-ring text-fg data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring',
          className,
        )}
      >
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon asChild>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 text-fg-subtle"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-[280px] overflow-hidden rounded-sm border border-border bg-surface shadow-md',
            'min-w-[var(--radix-select-trigger-width)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-150',
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {options.length === 0 && (
              <div className="px-3 py-4 text-center text-[12px] text-fg-subtle">Sin opciones</div>
            )}
            {options.map(option => {
              const itemValue = option.value === '' ? EMPTY_OPTION_VALUE : option.value
              return (
              <RadixSelect.Item
                key={itemValue}
                value={itemValue}
                disabled={option.disabled}
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-[3px] py-1.5 pl-2.5 pr-8 text-[13px] text-fg-muted outline-none transition-colors',
                  'data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg',
                  'data-[state=checked]:font-medium data-[state=checked]:text-brand-800',
                  'data-[disabled]:pointer-events-none data-[disabled]:text-fg-subtle',
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2 flex items-center text-brand-600">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
              )
            })}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  ),
)
Select.displayName = 'Select'

export { Select }
