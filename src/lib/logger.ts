import 'server-only'
import pino from 'pino'
import { env } from '@/config/env'
import { REDACT_CENSOR, REDACT_PATHS } from '@/lib/log-redact'
import { isPostHogEnabled } from '@/lib/posthog-config'
import { emitPinoLogToPostHog } from '@/lib/posthog-otel-logs'

const logger = pino({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR },
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
  ...(isPostHogEnabled() && {
    hooks: {
      logMethod(inputArgs, method, level) {
        const result = method.apply(this, inputArgs)
        emitPinoLogToPostHog(level, inputArgs, this)
        return result
      },
    },
  }),
})

export default logger
