import NextImage, { type ImageProps as NextImageProps } from 'next/image'
import { cn } from '@/lib/utils'

type BaseProps = Omit<NextImageProps, 'alt' | 'src'>

export type ImageProps = BaseProps & {
  src?: string | null
  alt?: string | null
  fallbackText?: string
}

/**
 * Wrapper del Image de Next con fallback consistente (cuando no hay src o falla la carga).
 * Usar cuando quieras thumbnails/galerías simples en UI ERP.
 *
 * `src` puede venir de una URL externa arbitraria (import CSV, WooCommerce, pegado manual),
 * así que se renderiza `unoptimized`: evita que el optimizador de Next haga un fetch
 * server-side de esa URL (vector de SSRF) y el navegador la carga directamente, como haría
 * un `<img>` plano.
 */
export function Image({
  src,
  alt,
  className,
  fallbackText,
  ...props
}: ImageProps) {
  const safeAlt = alt ?? ''
  if (!src) {
    return (
      <div
        className={cn('flex items-center justify-center rounded border border-border bg-surface-muted text-[10px] text-fg-subtle', className)}
        aria-label={safeAlt || fallbackText || 'Sin imagen'}
      >
        {fallbackText ?? null}
      </div>
    )
  }

  return (
    <NextImage
      src={src}
      alt={safeAlt}
      unoptimized
      className={cn('rounded border border-border bg-surface-muted object-cover', className)}
      {...props}
    />
  )
}

