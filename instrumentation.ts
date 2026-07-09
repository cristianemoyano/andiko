import type { InstrumentationOnRequestError } from 'next/dist/server/instrumentation/types'
import { logs, SeverityNumber, type Logger } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'

import {
  isPostHogEnabled,
  POSTHOG_HOST,
  POSTHOG_PROJECT_TOKEN,
  POSTHOG_SERVICE_NAME,
  posthogOtlpLogsUrl,
} from '@/lib/posthog-config'

export const posthogLoggerProvider: LoggerProvider | null = isPostHogEnabled()
  ? new LoggerProvider({
      resource: resourceFromAttributes({
        'service.name': POSTHOG_SERVICE_NAME,
      }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: posthogOtlpLogsUrl(POSTHOG_HOST),
            headers: {
              Authorization: `Bearer ${POSTHOG_PROJECT_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }),
        }),
      ],
    })
  : null

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && posthogLoggerProvider) {
    logs.setGlobalLoggerProvider(posthogLoggerProvider)
  }
}

export async function flushPostHogLogs(): Promise<void> {
  await posthogLoggerProvider?.forceFlush()
}

export function getPostHogOtelLogger(name: string = POSTHOG_SERVICE_NAME): Logger | null {
  return posthogLoggerProvider?.getLogger(name) ?? null
}

export { SeverityNumber }

/** Forwards unhandled server errors (API routes, RSC, actions) to PostHog Error Tracking. */
export const onRequestError: InstrumentationOnRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { captureRequestError } = await import('@/lib/posthog-errors')
    await captureRequestError(error, request, context)
  } catch (reportErr) {
    console.error('PostHog onRequestError failed:', reportErr)
  }
}
