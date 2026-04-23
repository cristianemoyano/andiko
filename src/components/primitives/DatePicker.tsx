'use client'
import { useState, useCallback } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { cn } from '@/lib/utils'

const defaultCN = getDefaultClassNames()

const DAY_PICKER_CLASS_NAMES = {
  root:            cn(defaultCN.root, 'p-2 text-[13px] text-zinc-900'),
  months:          'flex gap-4',
  month:           'relative flex flex-col',
  month_caption:   'flex items-center justify-center h-8 px-8 text-[13px] font-semibold text-zinc-800',
  caption_label:   '',
  nav:             'absolute inset-0 flex items-center justify-between pointer-events-none h-8',
  button_previous: cn(defaultCN.button_previous, 'pointer-events-auto w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-100 text-zinc-500'),
  button_next:     cn(defaultCN.button_next,     'pointer-events-auto w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-100 text-zinc-500'),
  month_grid:      'w-full border-collapse',
  weekdays:        'flex',
  weekday:         'w-8 h-7 flex items-center justify-center text-[11px] font-medium text-zinc-400',
  weeks:           'flex flex-col gap-0.5 mt-1',
  week:            'flex',
  day:             'w-8 h-8 p-0 flex items-center justify-center',
  day_button:      cn(
    'w-7 h-7 flex items-center justify-center rounded text-[12px] font-medium',
    'hover:bg-zinc-100 transition-colors cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
  ),
  selected:        '[&_button]:bg-brand-600 [&_button]:text-white [&_button]:hover:bg-brand-700',
  today:           '[&_button]:font-bold [&_button]:text-brand-700 [&_button]:border [&_button]:border-brand-300 [&_button]:bg-brand-50',
  outside:         'opacity-40',
  disabled:        'opacity-30 cursor-not-allowed',
  hidden:          'invisible',
  chevron:         'fill-current',
}

function dateToDisplay(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return ''
  const day   = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

function valueToLocalDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return undefined
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export interface DatePickerProps {
  value: Date | string | null | undefined
  onChange: (date: Date | null) => void
  error?: boolean
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  error,
  placeholder = 'DD/MM/AAAA',
  disabled,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = valueToLocalDate(value)

  const handleSelect = useCallback(
    (day: Date | undefined) => {
      onChange(
        day ? new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())) : null,
      )
      setOpen(false)
    },
    [onChange],
  )

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'flex h-8 w-full items-center gap-1.5 rounded-sm border bg-white px-2.5 text-left text-[13px] text-zinc-900 tabular-nums transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400',
            error
              ? 'border-red-500 focus-visible:ring-red-200'
              : 'border-zinc-300 focus-visible:ring-blue-200 focus-visible:border-blue-500',
            open && !error && 'border-blue-500 ring-2 ring-blue-200',
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          {dateToDisplay(value)
            ? <span>{dateToDisplay(value)}</span>
            : <span className="text-zinc-400">{placeholder}</span>
          }
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 rounded-md border border-zinc-200 bg-white p-1 shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            navLayout="around"
            classNames={DAY_PICKER_CLASS_NAMES}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4 1.75a.75.75 0 0 1 1.5 0V3h5V1.75a.75.75 0 0 1 1.5 0V3h.25A2.75 2.75 0 0 1 15 5.75v7.5A2.75 2.75 0 0 1 12.25 16H3.75A2.75 2.75 0 0 1 1 13.25v-7.5A2.75 2.75 0 0 1 3.75 3H4V1.75Zm-1.5 5.5v6a1.25 1.25 0 0 0 1.25 1.25h8.5A1.25 1.25 0 0 0 13.5 13.25v-6H2.5Zm1.75 2.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Zm3.25-.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Zm2.25.75a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75ZM4.25 11a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Zm2.25.75a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Zm3.25-.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
