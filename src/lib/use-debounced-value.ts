'use client'

import { useEffect, useState } from 'react'

/** Returns `value`, delayed by `delayMs` after it stops changing. Use for search inputs
 * that trigger a server request, so typing doesn't fire one request per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
