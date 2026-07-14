import { redirect } from 'next/navigation'

export default async function FacturaDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/expensas/${id}`)
}
