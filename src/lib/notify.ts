'use client'

import { toast } from 'sonner'

import { getApiErrorMessage } from '@/lib/fetch-json'

/** Toast de error a partir de un rechazo de {@link fetchJson} u otro `unknown`. */
export function notifyApiError(error: unknown, title = 'Error'): void {
  toast.error(title, { description: getApiErrorMessage(error) })
}

export function notifySuccess(message: string): void {
  toast.success(message)
}

export function notifyInfo(message: string): void {
  toast.message(message)
}

export { toast }
