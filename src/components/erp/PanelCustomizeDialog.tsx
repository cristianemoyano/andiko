'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Dialog } from '@/components/primitives/Dialog'
import { cn } from '@/lib/utils'
import { PANEL_WIDGETS, type PanelWidgetId } from '@/modules/panel/panel-widget.types'
import { usePanelWidgetsOptional } from './PanelWidgetProvider'

function arraysEqual(a: PanelWidgetId[], b: PanelWidgetId[]) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

function hiddenSetsEqual(a: PanelWidgetId[], b: PanelWidgetId[]) {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every(id => setB.has(id))
}

function IconDragHandle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  )
}

interface PanelCustomizeFormProps {
  onClose: () => void
}

function PanelCustomizeForm({ onClose }: PanelCustomizeFormProps) {
  const { hiddenIds, widgetOrder, applyLayout } = usePanelWidgetsOptional()
  const [draftOrder, setDraftOrder] = useState<PanelWidgetId[]>(() => [...widgetOrder])
  const [draftHidden, setDraftHidden] = useState<PanelWidgetId[]>(() => [...hiddenIds])
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const dirty = useMemo(
    () => !arraysEqual(draftOrder, widgetOrder) || !hiddenSetsEqual(draftHidden, hiddenIds),
    [draftOrder, draftHidden, widgetOrder, hiddenIds],
  )

  const toggleVisible = useCallback((id: PanelWidgetId) => {
    setDraftHidden(prev => (
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    ))
  }, [])

  const moveItem = useCallback((from: number, to: number) => {
    if (from === to) return
    setDraftOrder(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const handleSave = () => {
    applyLayout({ hidden: draftHidden, order: draftOrder })
    onClose()
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {draftOrder.map((id, index) => {
          const visible = !draftHidden.includes(id)
          return (
            <li
              key={id}
              className={cn(
                'flex items-center gap-3 px-5 py-3.5',
                dragOverIndex === index && 'bg-surface-muted',
              )}
              onDragOver={e => {
                e.preventDefault()
                if (dragIndex.current === null || dragIndex.current === index) return
                moveItem(dragIndex.current, index)
                dragIndex.current = index
                setDragOverIndex(index)
              }}
            >
              <Checkbox
                checked={visible}
                onCheckedChange={() => toggleVisible(id)}
                aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${PANEL_WIDGETS[id].label}`}
              />
              <span className={cn(
                'flex-1 text-[14px] select-none',
                visible ? 'text-fg' : 'text-fg-muted',
              )}
              >
                {PANEL_WIDGETS[id].label}
              </span>
              <button
                type="button"
                draggable
                onDragStart={() => {
                  dragIndex.current = index
                  setDragOverIndex(index)
                }}
                onDragEnd={() => {
                  dragIndex.current = null
                  setDragOverIndex(null)
                }}
                className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-sm text-fg-subtle hover:bg-surface-hover hover:text-fg active:cursor-grabbing"
                aria-label={`Reordenar ${PANEL_WIDGETS[id].label}`}
              >
                <IconDragHandle />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={!dirty} onClick={handleSave}>
          Guardar
        </Button>
      </div>
    </>
  )
}

interface PanelCustomizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PanelCustomizeDialog({ open, onOpenChange }: PanelCustomizeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Personalizar panel"
      description="Elegí qué tarjetas ver y arrastrá para cambiar el orden."
      size="sm"
      className="max-w-md"
    >
      {open ? <PanelCustomizeForm onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  )
}

/** Opens the panel customize dialog — always visible in the filter bar. */
export function PanelCustomizeButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 px-2.5 text-[12px] whitespace-nowrap"
        onClick={() => setOpen(true)}
        aria-label="Personalizar tarjetas del panel"
      >
        Editar
      </Button>
      <PanelCustomizeDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
