'use client'
import { useState, useRef, useCallback } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
  sublabel?: string
}

export interface SearchableSelectProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  onSelect?: (option: SearchableSelectOption | null) => void
  options?: SearchableSelectOption[]
  onSearch?: (query: string) => Promise<SearchableSelectOption[]>
  onCreateRequest?: (query: string) => void
  createActionLabel?: string
  placeholder?: string
  error?: boolean
  disabled?: boolean
  clearable?: boolean
  id?: string
  className?: string
}

function SearchableSelect({
  value,
  onChange,
  onSelect,
  options: staticOptions = [],
  onSearch,
  onCreateRequest,
  createActionLabel = 'Crear nuevo',
  placeholder = 'Seleccionar…',
  error,
  disabled,
  clearable = true,
  id,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [asyncOptions, setAsyncOptions] = useState<SearchableSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allOptions = onSearch ? asyncOptions : staticOptions
  const selectedOption = allOptions.find(o => o.value === value)
    ?? staticOptions.find(o => o.value === value)

  const filteredOptions = onSearch
    ? allOptions
    : staticOptions.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(query.toLowerCase()),
      )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery('')
      setAsyncOptions([])
    } else {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
    setOpen(nextOpen)
  }, [])

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q)
      if (!onSearch) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        setLoading(true)
        try {
          const results = await onSearch(q)
          setAsyncOptions(results)
        } finally {
          setLoading(false)
        }
      }, 300)
    },
    [onSearch],
  )

  const handleSelect = useCallback(
    (option: SearchableSelectOption) => {
      onChange(option.value)
      onSelect?.(option)
      setOpen(false)
    },
    [onChange, onSelect],
  )

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
      onSelect?.(null)
    },
    [onChange, onSelect],
  )

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded-sm border bg-white px-2.5 text-[13px] transition-colors text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400',
            error
              ? 'border-red-500 focus-visible:ring-red-200 text-red-900'
              : 'border-zinc-300 focus-visible:ring-blue-200 focus-visible:border-blue-500',
            open && !error && 'border-blue-500 ring-2 ring-blue-200',
            className,
          )}
        >
          <span className={cn('truncate', !selectedOption && 'text-zinc-400')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            {clearable && value && !disabled && (
              <span
                role="button"
                aria-label="Limpiar selección"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={e => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
                className="rounded text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 p-0.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </span>
            )}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('text-zinc-400 transition-transform duration-150', open && 'rotate-180')}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 rounded-sm border border-zinc-200 bg-white shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-150',
          )}
          style={{ width: 'var(--radix-popover-trigger-width)', maxHeight: '320px' }}
        >
          <div className="p-1.5 border-b border-zinc-100">
            <div className="relative">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar…"
                className="h-7 w-full rounded-sm border border-zinc-200 bg-white pl-7 pr-2 text-[12px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: '260px' }} role="listbox">
            {loading && (
              <div className="py-6 text-center text-[12px] text-zinc-400">Buscando…</div>
            )}
            {!loading && filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-[12px] text-zinc-400">
                <p>{query ? 'Sin resultados' : 'Sin opciones'}</p>
                {onCreateRequest && query.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => onCreateRequest(query.trim())}
                    className="mt-2 inline-flex items-center rounded-sm border border-zinc-300 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    {createActionLabel}
                  </button>
                )}
              </div>
            )}
            {!loading && filteredOptions.map(option => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => handleSelect(option)}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-[13px] transition-colors',
                  'hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none',
                  option.value === value && 'bg-brand-50 text-brand-800',
                )}
              >
                <span className="font-medium leading-tight">{option.label}</span>
                {option.sublabel && (
                  <span className="text-[11px] text-zinc-500 leading-tight">{option.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { SearchableSelect }
