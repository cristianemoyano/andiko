import { useEffect, useState } from 'react'
import {
  getShiftDurationMs,
  getShiftDurationState,
  type ShiftDurationState,
} from './cash-session-duration'

const TICK_MS = 30_000

export function useShiftElapsed(openedAt: string | null | undefined): {
  durationMs: number
  state: ShiftDurationState
} {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!openedAt) return
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [openedAt])

  if (!openedAt) {
    return { durationMs: 0, state: 'normal' }
  }

  const durationMs = getShiftDurationMs(openedAt, nowMs)
  return { durationMs, state: getShiftDurationState(durationMs) }
}
