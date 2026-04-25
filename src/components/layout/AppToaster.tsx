'use client'

import { Toaster } from 'sonner'

/**
 * Sonner: toasts accesibles, usados por {@link notifyApiError} / {@link notifySuccess}.
 * Montado una sola vez dentro de {@link Providers}.
 */
export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: 'text-sm',
          title: 'font-medium',
          description: 'text-zinc-600',
        },
      }}
    />
  )
}
