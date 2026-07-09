import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { AppVersion } from '@/components/layout/AppVersion'
import { siteConfig } from '@/lib/site'
import { cn } from '@/lib/utils'

const brandHighlights = [
  'Ventas y facturación',
  'Stock e inventario',
  'Compras y proveedores',
  'Contabilidad integrada',
] as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell relative flex min-h-screen overflow-hidden bg-[#F7FBFC]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#EEF8FA_0%,#FFFFFF_42%,#F7FBFC_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(12,100,122,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(12,100,122,0.025)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,black,transparent)]"
      />
      <div
        aria-hidden
        className="landing-orb pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="landing-orb landing-orb-delay pointer-events-none absolute -right-16 bottom-32 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl"
      />

      {/* Brand panel — desktop */}
      <aside className="relative z-10 hidden w-[52%] flex-col justify-between border-r border-brand-100/60 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 text-white xl:w-[55%] xl:p-14 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-1/4 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl"
        />

        <div className="relative landing-enter">
          <AndikoLogo href="/" size="lg" className="[&_span]:text-white [&_div]:shadow-brand-900/30" />
        </div>

        <div className="relative landing-enter landing-enter-delay-1">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-200" aria-hidden />
            Software de gestión
          </p>
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Tu negocio,{' '}
            <span className="text-brand-200">en orden</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-100/90">
            {siteConfig.description}
          </p>

          <ul className="mt-8 space-y-3">
            {brandHighlights.map((item, index) => (
              <li
                key={item}
                className={cn(
                  'flex items-center gap-3 text-sm text-brand-50/95 landing-enter',
                  `landing-enter-delay-${Math.min(index + 2, 4)}`,
                )}
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-[1.75]" aria-hidden>
                    <path d="M2.5 6l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative landing-enter landing-enter-delay-4 flex items-center justify-between text-xs text-brand-200/70">
          <span>© {new Date().getFullYear()} Andiko</span>
          <AppVersion className="text-brand-200/60" />
        </div>
      </aside>

      {/* Form panel */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="mb-8 lg:hidden landing-enter">
          <AndikoLogo href="/" size="md" />
        </div>

        <div className="w-full max-w-[420px] landing-enter landing-enter-delay-1">{children}</div>

        <AppVersion className="mt-8 lg:hidden" />

        <div className="mt-4 flex items-center gap-3">
          <a href="/legales/terminos" className="text-xs text-fg-subtle hover:underline">
            Términos
          </a>
          <a href="/legales/privacidad" className="text-xs text-fg-subtle hover:underline">
            Privacidad
          </a>
        </div>
      </div>
    </div>
  )
}
