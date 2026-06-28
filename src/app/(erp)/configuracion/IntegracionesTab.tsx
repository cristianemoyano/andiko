'use client'

import { WoocommerceSitesPanel } from '@/app/(erp)/integraciones/woocommerce/WoocommerceClient'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'

export function IntegracionesTab() {
  const { capabilities } = useCapabilities()
  const canWrite = capabilities?.integraciones.write ?? false

  return <WoocommerceSitesPanel canWrite={canWrite} embedded />
}
