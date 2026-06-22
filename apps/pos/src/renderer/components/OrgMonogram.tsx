type MonogramSize = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<MonogramSize, string> = {
  sm: 'w-9 h-9 text-xs rounded-lg',
  md: 'w-10 h-10 text-sm rounded-lg',
  lg: 'w-16 h-16 text-xl rounded-2xl',
}

/** Derives up to two uppercase initials from an organization name. */
export function orgInitials(name: string | null | undefined): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !/^(s\.?a\.?|s\.?r\.?l\.?|srl|sa|sas|y|de|del|la|el)$/i.test(w))

  if (words.length === 0) return '·'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

export function OrgMonogram({
  name,
  size = 'md',
  className = '',
}: {
  name: string | null | undefined
  size?: MonogramSize
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={`shrink-0 bg-brand-600 text-white font-semibold flex items-center justify-center tracking-tight select-none shadow-sm ${SIZE_CLASSES[size]} ${className}`}
    >
      {orgInitials(name)}
    </div>
  )
}
