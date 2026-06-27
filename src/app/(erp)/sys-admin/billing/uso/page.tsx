import { redirect } from 'next/navigation'

/** Consumo medido vive en el detalle de cada suscripción. */
export default function UsoPage() {
  redirect('/sys-admin/billing')
}
