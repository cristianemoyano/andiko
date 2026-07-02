import sequelize from '@/lib/db'

/** Canonical Sequelize model instance (survives Next.js HMR better than the local class). */
export function registeredModel<T>(name: string, fallback: T): T {
  return (sequelize.models[name] as T | undefined) ?? fallback
}

export function ensureAssociation(
  model: { associations: Record<string, unknown> },
  alias: string,
  register: () => void,
): void {
  if (!model.associations[alias]) register()
}
