/** URL-safe slug from display name (Spanish-friendly). */
export function slugifyText(input: string): string {
  const s = input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
  return s.slice(0, 100).replace(/^-|-$/g, '') || 'org'
}
