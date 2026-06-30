export function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/')
}

/** Sys-admin impersonation must not enter the onboarding funnel (avoids redirect loops). */
export function shouldSkipOnboardingEnforcement(user: {
  realRole?: string | null
  impersonation?: unknown
}): boolean {
  return user.realRole === 'sys-admin' && user.impersonation != null
}

/** Force redirect to onboarding from ERP layout (not when pathname is unknown). */
export function shouldLayoutForceOnboardingRedirect(
  pathname: string,
  status: { completed: boolean; hasProgress: boolean },
): boolean {
  if (status.completed || status.hasProgress) return false
  if (isOnboardingPath(pathname)) return false
  // x-pathname from proxy may be missing during RSC; post-auth handles entry in that case.
  if (pathname === '') return false
  return true
}
