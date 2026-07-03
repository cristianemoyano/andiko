import posthog from 'posthog-js'

import { COOKIE_CONSENT_ENABLED } from '@/lib/cookie-consent'
import { isPostHogEnabled, posthogUiHost, POSTHOG_HOST, POSTHOG_PROJECT_TOKEN } from '@/lib/posthog-config'

if (isPostHogEnabled()) {
  posthog.init(POSTHOG_PROJECT_TOKEN!, {
    api_host: '/ingest',
    ui_host: posthogUiHost(POSTHOG_HOST),
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
    opt_out_capturing_by_default: COOKIE_CONSENT_ENABLED,
  })
}
