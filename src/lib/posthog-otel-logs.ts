import 'server-only'

import type { LogDescriptor } from 'pino'
import { SeverityNumber } from '@opentelemetry/api-logs'

import { getPostHogOtelLogger } from '../../instrumentation'
import { POSTHOG_SERVICE_NAME } from '@/lib/posthog-config'

const PINO_LEVEL_TO_SEVERITY: Record<number, SeverityNumber> = {
  10: SeverityNumber.TRACE,
  20: SeverityNumber.DEBUG,
  30: SeverityNumber.INFO,
  40: SeverityNumber.WARN,
  50: SeverityNumber.ERROR,
  60: SeverityNumber.FATAL,
}

/** Forwards a pino log line to PostHog via OpenTelemetry. */
export function emitPinoLogToPostHog(
  level: number,
  inputArgs: unknown[],
  bindings: LogDescriptor,
): void {
  const logger = getPostHogOtelLogger(POSTHOG_SERVICE_NAME)
  if (!logger) return

  let mergeObj: Record<string, unknown> = { ...bindings }
  let body: string | undefined

  if (typeof inputArgs[0] === 'object' && inputArgs[0] !== null && !Array.isArray(inputArgs[0])) {
    mergeObj = { ...mergeObj, ...(inputArgs[0] as Record<string, unknown>) }
    if (typeof inputArgs[1] === 'string') body = inputArgs[1]
  } else if (typeof inputArgs[0] === 'string') {
    body = inputArgs[0]
  }

  if (!body) {
    body = typeof mergeObj.msg === 'string' ? mergeObj.msg : 'log'
  }

  const severityNumber = PINO_LEVEL_TO_SEVERITY[level] ?? SeverityNumber.INFO
  const attributes = { ...mergeObj }
  delete attributes.msg
  delete attributes.time
  delete attributes.level
  delete attributes.pid
  delete attributes.hostname

  logger.emit({
    body,
    severityNumber,
    attributes: {
      ...attributes,
      'log.level': level,
    },
  })
}
