import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Read `Response` body as JSON when non-empty; avoids throw on empty 500 bodies. */
export async function parseResponseBodyJson<T>(res: Response): Promise<T | null> {
  const raw = await res.text()
  const t = raw.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as T
  } catch {
    return null
  }
}
