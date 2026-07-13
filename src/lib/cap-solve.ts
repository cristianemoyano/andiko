'use client'

import Cap from 'cap-widget'

import { capApiEndpoint, isCapEnabled } from '@/lib/cap-config'

/** Solves an invisible Cap challenge programmatically. Returns null when Cap is disabled. */
export async function solveCapChallenge(): Promise<string | null> {
  if (!isCapEnabled()) return null

  const cap = new Cap({ apiEndpoint: capApiEndpoint() })
  const { token } = await cap.solve()
  return token
}
