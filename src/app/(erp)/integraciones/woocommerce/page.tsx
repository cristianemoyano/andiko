import type { Metadata } from 'next'
import { WoocommerceClient } from './WoocommerceClient'

export const metadata: Metadata = { title: 'WooCommerce' }

export default function WoocommercePage() {
  return <WoocommerceClient />
}
