'use client'

import {
  AfipCertificadoSection,
  AfipContingencySection,
  AfipDatosFiscalesSection,
  AfipPieTicketPosSection,
  AfipPuntosDeVentaSection,
} from '@/components/erp/afip'

export function AfipConfigTab() {
  return (
    <div className="space-y-5">
      <AfipDatosFiscalesSection />
      <AfipPieTicketPosSection />
      <AfipPuntosDeVentaSection />
      <AfipCertificadoSection />
      <AfipContingencySection />
    </div>
  )
}
