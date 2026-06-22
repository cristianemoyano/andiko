export function formatUserDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export function splitLegacyUserName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim()
  if (!trimmed) return { firstName: '', lastName: '' }
  const space = trimmed.indexOf(' ')
  if (space === -1) return { firstName: trimmed, lastName: '' }
  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim(),
  }
}

export function resolveUserNameParts(input: {
  firstName?: string
  lastName?: string
  name?: string
}): { firstName: string; lastName: string; displayName: string } {
  if (input.firstName !== undefined) {
    const firstName = input.firstName.trim()
    const lastName = (input.lastName ?? '').trim()
    return {
      firstName,
      lastName,
      displayName: formatUserDisplayName(firstName, lastName),
    }
  }
  if (input.name !== undefined) {
    const { firstName, lastName } = splitLegacyUserName(input.name)
    return {
      firstName,
      lastName,
      displayName: formatUserDisplayName(firstName, lastName),
    }
  }
  throw new Error('USER_NAME_REQUIRED')
}
