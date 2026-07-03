import { CredentialsSignin } from 'next-auth'
import { LOGIN_THROTTLED_CODE_PREFIX } from './login-throttle-message'

/** Thrown from the credentials `authorize` callback when login is rate-limited. */
export class LoginThrottledError extends CredentialsSignin {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super()
    this.retryAfterSeconds = retryAfterSeconds
    this.code = `${LOGIN_THROTTLED_CODE_PREFIX}${retryAfterSeconds}`
  }
}
