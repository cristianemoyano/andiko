'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from '@/components/primitives/Button'

// The real `CookieConsentBanner` is gated behind `COOKIE_CONSENT_ENABLED`.
// This story renders the same markup directly so the visual design stays covered in Storybook.
function CookieConsentBannerPreview() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] border-t border-border bg-surface p-4">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-muted leading-relaxed">
          Usamos cookies necesarias para el funcionamiento de la Plataforma y, si lo aceptás,
          cookies de analítica para mejorar el Servicio.
        </p>
        <div className="flex flex-shrink-0 gap-2">
          <Button variant="secondary" size="sm">
            Solo necesarias
          </Button>
          <Button variant="primary" size="sm">
            Aceptar todo
          </Button>
        </div>
      </div>
    </div>
  )
}

const meta: Meta<typeof CookieConsentBannerPreview> = {
  title: 'Layout/CookieConsentBanner',
  component: CookieConsentBannerPreview,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Controlado por el flag `COOKIE_CONSENT_ENABLED` (`src/lib/cookie-consent.ts`).',
      },
    },
  },
  decorators: [
    Story => (
      <div className="relative h-40 w-full bg-surface-muted">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof CookieConsentBannerPreview>

export const Default: Story = {}
