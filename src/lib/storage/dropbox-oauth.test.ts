import { describe, it, expect, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    AUTH_SECRET: 'unit-test-secret-key-1234567890',
    AUTH_URL: 'http://localhost:3000',
  },
}))

import {
  buildDropboxAuthorizeUrl,
  getDropboxOAuthRedirectUri,
  signDropboxOAuthState,
  verifyDropboxOAuthState,
} from './dropbox-oauth'

describe('dropbox-oauth', () => {
  it('builds redirect URI from AUTH_URL', () => {
    expect(getDropboxOAuthRedirectUri()).toBe(
      'http://localhost:3000/api/v1/sys-admin/storage-settings/dropbox/callback',
    )
  })

  it('signs and verifies OAuth state', () => {
    const state = signDropboxOAuthState()
    expect(verifyDropboxOAuthState(state)).toBe(true)
    expect(verifyDropboxOAuthState('bad.state')).toBe(false)
  })

  it('builds authorize URL with offline access', () => {
    const url = buildDropboxAuthorizeUrl('my-app-key', 'signed-state')
    expect(url).toContain('client_id=my-app-key')
    expect(url).toContain('token_access_type=offline')
    expect(url).toContain('files.content.read')
    expect(url).toContain('redirect_uri=')
  })
})
