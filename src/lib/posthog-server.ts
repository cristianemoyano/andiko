import 'server-only'

import { PostHog } from 'posthog-node'

import { isPostHogEnabled, POSTHOG_HOST, POSTHOG_PROJECT_TOKEN } from '@/lib/posthog-config'

let posthogClient: PostHog | null = null

export function getPostHogClient(): PostHog | null {
  if (!isPostHogEnabled()) return null

  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_PROJECT_TOKEN!, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }

  return posthogClient
}

export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown()
    posthogClient = null
  }
}
