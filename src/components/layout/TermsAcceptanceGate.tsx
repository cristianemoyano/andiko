'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Button } from '@/components/primitives/Button'

export function TermsAcceptanceGate({ required }: { required: boolean }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!required) return null

  async function handleAccept() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/me/terms-acceptance', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'No se pudo registrar la aceptación. Intentá de nuevo.')
        setSubmitting(false)
        return
      }
      router.refresh()
    } catch {
      setError('No se pudo registrar la aceptación. Intentá de nuevo.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={() => {}}
      hideClose
      title="Términos de Servicio y Política de Privacidad"
      footer={
        <DialogFooter error={error}>
          <Button
            variant="primary"
            disabled={!checked || submitting}
            onClick={handleAccept}
          >
            Aceptar y continuar
          </Button>
        </DialogFooter>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted leading-relaxed">
          Para continuar usando Andiko necesitamos que aceptes nuestros Términos de Servicio
          y nuestra Política de Privacidad, que explican cómo tratamos los datos de tu cuenta
          y de tu organización.
        </p>
        <div className="flex gap-4 text-sm">
          <a
            href="/legales/terminos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline"
          >
            Ver Términos de Servicio
          </a>
          <a
            href="/legales/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline"
          >
            Ver Política de Privacidad
          </a>
        </div>
        <Checkbox
          checked={checked}
          onCheckedChange={(state) => setChecked(state === true)}
          label="Leí y acepto los Términos de Servicio y la Política de Privacidad"
        />
      </div>
    </Dialog>
  )
}
