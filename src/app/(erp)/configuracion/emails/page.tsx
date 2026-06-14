import { redirect } from 'next/navigation'

export default function EmailLogsRedirectPage() {
  redirect('/configuracion?section=emails-enviados')
}
