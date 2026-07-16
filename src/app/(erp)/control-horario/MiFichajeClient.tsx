'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { formatLocalTime } from '@/lib/date-only'
import { ControlHorarioSubNav } from './ControlHorarioSubNav'
import type { MyStatus } from './types'

const EVENT_LABEL: Record<string, string> = {
  clock_in: 'Entrada',
  clock_out: 'Salida',
  absence: 'Ausencia',
}

export function MiFichajeClient() {
  const [status, setStatus] = useState<MyStatus | null>(null)
  const [notLinked, setNotLinked] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadError(null)
      setNotLinked(false)
      try {
        const res = await fetchJson<{ data: MyStatus }>('/api/v1/attendance/me')
        if (!mounted) return
        setStatus(res.data)
      } catch (e) {
        if (!mounted) return
        if (isApiRequestError(e) && e.code === 'EMPLOYEE_NOT_LINKED') {
          setNotLinked(true)
        } else {
          setLoadError(getApiErrorMessage(e))
        }
        setStatus(null)
      }
    })()
    return () => { mounted = false }
  }, [refresh])

  async function handlePunch() {
    if (!status) return
    setActing(true)
    try {
      await fetchJson(status.clockedIn ? '/api/v1/attendance/me/clock-out' : '/api/v1/attendance/me/clock-in', {
        method: 'POST',
      })
      notifySuccess(status.clockedIn ? 'Salida registrada' : 'Entrada registrada')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Control de Horario', href: '/control-horario' }, { label: 'Mi fichaje' }]} />
      <ControlHorarioSubNav />

      <PageBody>
        {notLinked && (
          <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-fg-muted">
            Tu usuario no tiene un legajo de empleado vinculado. Pedile a un administrador que te vincule desde
            «Empleados» para poder fichar tu entrada y salida.
          </div>
        )}

        {!notLinked && loadError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {loadError}
          </div>
        )}

        {!notLinked && status && (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="flex flex-col items-center gap-2">
              <Badge status={status.clockedIn ? 'success' : 'draft'} dot>
                {status.clockedIn ? 'Turno abierto' : 'Sin turno abierto'}
              </Badge>
              {status.clockedIn && status.since && (
                <p className="text-[13px] text-fg-muted">Desde las {formatLocalTime(status.since)}</p>
              )}
            </div>

            <Button size="lg" onClick={handlePunch} disabled={acting} variant={status.clockedIn ? 'danger' : 'primary'}>
              {acting ? 'Procesando…' : status.clockedIn ? 'Registrar salida' : 'Registrar entrada'}
            </Button>

            <div className="w-full max-w-sm">
              <p className="mb-2 text-[12px] font-medium text-fg-muted">Hoy</p>
              {status.todayEvents.length === 0 ? (
                <p className="text-[13px] text-fg-subtle">Todavía no registraste fichadas hoy.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {status.todayEvents.map(ev => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 text-[13px]"
                    >
                      <span className="font-medium text-fg">{EVENT_LABEL[ev.event_type] ?? ev.event_type}</span>
                      <span className="tabular-nums text-fg-muted">{formatLocalTime(ev.occurred_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </div>
  )
}
