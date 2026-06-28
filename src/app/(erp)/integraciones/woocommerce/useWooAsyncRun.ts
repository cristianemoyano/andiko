'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { formatImportEtaRemaining } from '@/lib/import-progress'

export interface WooAsyncRunStatus {
  status: 'idle' | 'running' | 'completed' | 'cancelled'
  total: number
  processed: number
  failed: number
  pending: number
  started_at: string | null
}

interface UseWooAsyncRunOptions {
  siteId: string | null
  endpoint: string
  unitLabel: string
  buildStartBody: () => Record<string, unknown>
  onComplete?: () => void
  onError?: (message: string) => void
  resumeOnMount?: boolean
}

export function useWooAsyncRun({
  siteId,
  endpoint,
  unitLabel,
  buildStartBody,
  onComplete,
  onError,
  resumeOnMount = true,
}: UseWooAsyncRunOptions) {
  const [running, setRunning] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null)
  const [eta, setEta] = useState<string | null>(null)
  const [failed, setFailed] = useState(0)
  const startedAtRef = useRef<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickInFlightRef = useRef(false)
  const buildStartBodyRef = useRef(buildStartBody)

  useEffect(() => {
    buildStartBodyRef.current = buildStartBody
  }, [buildStartBody])

  const updateProgress = useCallback((processed: number, total: number) => {
    setProgress({ processed, total })
    const startedAt = startedAtRef.current
    if (startedAt != null && total > 0) {
      setEta(formatImportEtaRemaining(processed, total, Date.now() - startedAt))
    }
  }, [])

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const applyStatus = useCallback((status: WooAsyncRunStatus) => {
    if (status.status === 'running' || status.total > 0) {
      updateProgress(status.processed, status.total)
      setFailed(status.failed)
    }
    if (status.status === 'completed') {
      setRunning(false)
      stopPoll()
      startedAtRef.current = null
      setEta(null)
      onComplete?.()
    } else if (status.status === 'cancelled') {
      setCancelled(true)
      setRunning(false)
      stopPoll()
      startedAtRef.current = null
      setEta(null)
      setFailed(status.failed)
    } else if (status.status === 'running') {
      setRunning(true)
    }
  }, [onComplete, stopPoll, updateProgress])

  const tick = useCallback(async () => {
    if (!siteId || tickInFlightRef.current) return
    tickInFlightRef.current = true
    try {
      const status = await fetchJson<WooAsyncRunStatus>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'tick' }),
      })
      applyStatus(status)
    } catch (err) {
      if (isApiRequestError(err) && (err.status === 404 || err.code === 'SITE_NOT_FOUND')) {
        stopPoll()
        setRunning(false)
        onError?.('El sitio ya no existe. Actualizá la lista de sitios.')
        return
      }
      onError?.(getApiErrorMessage(err))
    } finally {
      tickInFlightRef.current = false
    }
  }, [applyStatus, endpoint, onError, siteId, stopPoll])

  const startPoll = useCallback(() => {
    stopPoll()
    void tick()
    pollRef.current = setInterval(() => void tick(), 1500)
  }, [stopPoll, tick])

  const start = useCallback(async () => {
    if (!siteId) return
    setRunning(true)
    setCancelled(false)
    setFailed(0)
    setProgress(null)
    setEta(null)
    startedAtRef.current = Date.now()

    try {
      const status = await fetchJson<WooAsyncRunStatus>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'start', ...buildStartBodyRef.current() }),
      })
      if (status.status === 'completed' && status.total === 0) {
        setRunning(false)
        updateProgress(0, 0)
        startedAtRef.current = null
        onComplete?.()
        return
      }
      if (status.started_at) {
        startedAtRef.current = new Date(status.started_at).getTime()
      }
      applyStatus(status)
      startPoll()
    } catch (err) {
      setRunning(false)
      startedAtRef.current = null
      onError?.(getApiErrorMessage(err))
    }
  }, [applyStatus, endpoint, onComplete, onError, siteId, startPoll, updateProgress])

  const cancel = useCallback(async () => {
    if (!siteId) return
    stopPoll()
    tickInFlightRef.current = true
    try {
      const status = await fetchJson<WooAsyncRunStatus>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel' }),
      })
      applyStatus(status)
    } catch (err) {
      onError?.(getApiErrorMessage(err))
    } finally {
      tickInFlightRef.current = false
    }
  }, [applyStatus, endpoint, onError, siteId, stopPoll])

  useEffect(() => {
    if (!resumeOnMount || !siteId) return
    let disposed = false

    ;(async () => {
      try {
        const status = await fetchJson<WooAsyncRunStatus>(endpoint, { method: 'GET' })
        if (disposed) return
        if (status.status === 'running') {
          if (status.started_at) {
            startedAtRef.current = new Date(status.started_at).getTime()
          }
          applyStatus(status)
          startPoll()
        }
      } catch {
        // ignore resume errors
      }
    })()

    return () => {
      disposed = true
      stopPoll()
    }
  }, [applyStatus, endpoint, resumeOnMount, siteId, startPoll, stopPoll])

  return {
    running,
    cancelled,
    progress,
    eta,
    failed,
    unitLabel,
    start,
    cancel,
  }
}
