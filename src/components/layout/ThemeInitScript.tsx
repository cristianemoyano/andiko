import { THEME_INIT_INLINE } from '@/lib/theme-init-script'

/** SSR-only theme bootstrap — see src/lib/theme-init-script.ts */
export function ThemeInitScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_INIT_INLINE }}
    />
  )
}
