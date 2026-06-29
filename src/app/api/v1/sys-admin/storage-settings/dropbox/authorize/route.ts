import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { getResolvedDropboxOAuthCredentials } from '@/modules/storage/storage-settings.service'
import {
  buildDropboxAuthorizeUrl,
  signDropboxOAuthState,
} from '@/lib/storage/dropbox-oauth'

/** Starts Dropbox OAuth — redirects the sys-admin to Dropbox to grant offline access. */
export async function GET() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const creds = await getResolvedDropboxOAuthCredentials()
  if (!creds) {
    return NextResponse.json(
      {
        error: 'Guardá App key y App secret antes de conectar con Dropbox',
        code: 'STORAGE_NOT_CONFIGURED',
      },
      { status: 422 },
    )
  }

  const state = signDropboxOAuthState()
  const url = buildDropboxAuthorizeUrl(creds.appKey, state)
  return NextResponse.redirect(url)
}
