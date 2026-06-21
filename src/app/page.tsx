import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { AppVersion } from '@/components/layout/AppVersion'
import { createPageMetadata, siteConfig, siteUrl } from '@/lib/site'
import { ContactForm } from './ContactForm'
import { DashboardMockup } from './DashboardMockup'

export const metadata = createPageMetadata({
  title: `${siteConfig.title} | ${siteConfig.tagline}`,
  description: siteConfig.description,
  path: '/',
})

const ArrowRight = ({ className = 'h-[17px] w-[17px]' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

const Check = ({ className = 'h-[15px] w-[15px]' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const navLinks = [
  { label: 'Producto', href: '#sec-producto' },
  { label: 'Módulos', href: '#sec-modulos' },
  { label: 'Precios', href: '#sec-precios' },
  { label: 'Contacto', href: '#sec-contacto' },
] as const

const trustItems = ['Sin tarjeta de crédito', 'Implementación guiada', 'Soporte en español'] as const

const modules = [
  {
    title: 'Facturación y cobranzas',
    body: 'Emití facturas A, B y C con ARCA en segundos. Seguí cobranzas, vencimientos y la cuenta corriente de cada cliente.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
  },
  {
    title: 'Stock e inventario',
    body: 'Control de stock por depósito y sucursal, con alertas de punto de pedido y trazabilidad de cada movimiento.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    title: 'Compras y cuentas a pagar',
    body: 'Órdenes de compra, recepción de remitos y pagos a proveedores, todo conciliado con tu stock y tu contabilidad.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h14l-1.4 9.2a2 2 0 0 1-2 1.8h-7.2a2 2 0 0 1-2-1.8z" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        <path d="M9 11h6" />
      </svg>
    ),
  },
  {
    title: 'Contabilidad y documentos fiscales',
    body: 'Libro diario, IVA y reportes fiscales listos para tu contador. Sin exportar a planillas ni rehacer la carga.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" />
        <line x1="8" x2="16" y1="6" y2="6" />
        <line x1="16" x2="16" y1="14" y2="18" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M8 14h.01" />
        <path d="M12 18h.01" />
        <path d="M8 18h.01" />
      </svg>
    ),
  },
] as const

const reasons = [
  {
    title: 'Hecho para Argentina',
    body: 'La facturación electrónica ARCA y los circuitos fiscales locales vienen de fábrica. No adaptás software extranjero a la fuerza.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: 'Un solo sistema',
    body: 'Basta de planillas e integraciones frágiles. Ventas, stock, compras y contabilidad comparten los mismos datos, siempre.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
        <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
        <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      </svg>
    ),
  },
  {
    title: 'Rápido de operar',
    body: 'Pensado para teclado y flujos cortos. Tu equipo administrativo carga comprobantes sin fricción ni clics de más.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
      </svg>
    ),
  },
] as const

const metrics = [
  { value: '4', label: 'módulos integrados' },
  { value: '100%', label: 'operativo en ARS' },
  { value: 'Multi', label: 'sucursal y depósito' },
  { value: 'ARCA', label: 'facturación nativa' },
] as const

const sectors = ['Retail y comercios', 'Distribución y mayoristas', 'Servicios', 'Industria y manufactura'] as const

function LandingJsonLd() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: siteConfig.name,
        url: siteUrl,
        description: siteConfig.description,
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: siteConfig.language,
        publisher: { '@id': `${siteUrl}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/#software`,
        name: siteConfig.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: siteConfig.description,
        inLanguage: siteConfig.language,
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/PreOrder',
          price: '0',
          priceCurrency: 'ARS',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect(await resolvePostAuthRedirect(session))

  return (
    <>
      <LandingJsonLd />

      <div className="relative min-h-full overflow-hidden bg-[#F7FBFC]">
        {/* Atmospheric background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,#EEF8FA_0%,#FFFFFF_46%,#F7FBFC_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(12,100,122,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(12,100,122,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_28%,#000_0%,transparent_78%)]"
        />
        <div
          aria-hidden
          className="landing-orb pointer-events-none absolute -left-28 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-brand-300/30 blur-[90px]"
        />
        <div
          aria-hidden
          className="landing-orb landing-orb-delay pointer-events-none absolute -bottom-48 -right-32 z-0 h-[560px] w-[560px] rounded-full bg-brand-400/20 blur-[100px]"
        />

        <div className="relative z-10">
          {/* ░░ HEADER ░░ */}
          <header className="sticky top-0 z-50 h-16 border-b border-zinc-200/60 bg-white/70 backdrop-blur-md">
            <div className="mx-auto flex h-full max-w-[1200px] items-center gap-7 px-[clamp(20px,5vw,56px)]">
              <AndikoLogo size="sm" />
              <nav className="ml-3 hidden items-center gap-[26px] md:flex">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-zinc-600 transition-colors hover:text-brand-600"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="hidden h-[38px] items-center rounded-[4px] px-3.5 text-sm font-medium text-zinc-900 transition-colors hover:text-brand-600 md:inline-flex"
                >
                  Iniciar sesión
                </Link>
                <a
                  href="#sec-contacto"
                  className="inline-flex h-[38px] items-center rounded-[4px] bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-colors hover:bg-brand-700"
                >
                  Solicitar demo
                </a>
              </div>
            </div>
          </header>

          {/* ░░ HERO ░░ */}
          <section className="mx-auto max-w-[1200px] px-[clamp(20px,5vw,56px)] pb-[clamp(28px,4vw,48px)] pt-[clamp(40px,6vw,84px)]">
            <div className="flex flex-wrap items-center gap-[clamp(36px,5vw,64px)]">
              {/* Left copy */}
              <div className="min-w-[320px] flex-1 basis-[440px]">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-brand-200 bg-white/70 py-1.5 pl-3 pr-3.5 shadow-sm shadow-brand-600/[0.06] backdrop-blur-sm">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand-400" />
                    <span className="relative inline-block h-2 w-2 rounded-full bg-brand-500" />
                  </span>
                  <span className="landing-badge-shimmer text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {siteConfig.tagline} · Beta privada
                  </span>
                </div>

                <h1 className="mt-[22px] text-[clamp(34px,4.6vw,55px)] font-semibold leading-[1.04] tracking-[-0.025em] text-zinc-900 text-balance">
                  El ERP hecho para{' '}
                  <span className="bg-gradient-to-r from-brand-700 via-brand-500 to-brand-400 bg-clip-text text-transparent">
                    las pymes argentinas
                  </span>
                </h1>

                <p className="mt-5 max-w-[30em] text-base leading-relaxed text-zinc-600">
                  Ventas, stock, compras y finanzas en un solo flujo. Facturación electrónica con
                  ARCA, multisucursal y pensado para cómo trabaja tu pyme — sin planillas ni
                  integraciones frágiles.
                </p>

                <div className="mt-[30px] flex flex-wrap gap-3">
                  <a
                    href="#sec-contacto"
                    className="inline-flex h-11 items-center gap-2.5 whitespace-nowrap rounded-[4px] bg-brand-600 px-[22px] text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(12,100,122,0.28)] transition-[background-color,transform] hover:-translate-y-px hover:bg-brand-700"
                  >
                    Quiero probarlo
                    <ArrowRight />
                  </a>
                  <a
                    href="#sec-modulos"
                    className="inline-flex h-11 items-center whitespace-nowrap rounded-[4px] border border-zinc-300 bg-white px-5 text-[15px] font-semibold text-zinc-900 transition-colors hover:border-zinc-400 hover:bg-zinc-100"
                  >
                    Ver módulos
                  </a>
                </div>

                <div className="mt-[22px] flex flex-wrap gap-[18px]">
                  {trustItems.map((item) => (
                    <span key={item} className="inline-flex items-center gap-[7px] text-[13px] text-zinc-600">
                      <span className="text-brand-500">
                        <Check />
                      </span>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: dashboard mockup */}
              <div className="min-w-[320px] flex-1 basis-[500px]">
                <DashboardMockup />
              </div>
            </div>
          </section>

          {/* decorative line */}
          <div className="mx-auto h-px max-w-[1100px] bg-gradient-to-r from-transparent via-brand-300/60 to-transparent" />

          {/* ░░ MODULES ░░ */}
          <section id="sec-modulos" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] pb-[clamp(32px,4vw,56px)] pt-[clamp(56px,7vw,96px)]">
            <div className="max-w-[640px]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">Módulos</div>
              <h2 className="mt-3 text-[clamp(26px,3vw,32px)] font-semibold leading-[1.12] tracking-[-0.02em] text-zinc-900">
                Un módulo para cada parte de tu operación
              </h2>
              <p className="mt-3.5 text-base leading-relaxed text-zinc-600">
                Cuatro módulos integrados que comparten clientes, productos y comprobantes. Activás
                lo que necesitás y todo conversa entre sí.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(252px,1fr))] gap-[18px]">
              {modules.map((mod) => (
                <div
                  key={mod.title}
                  className="rounded-xl border border-zinc-200/70 bg-white/70 p-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md transition-[transform,border-color,box-shadow] duration-[160ms] hover:-translate-y-[3px] hover:border-brand-200 hover:shadow-[0_14px_34px_rgba(208,238,243,0.7)]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-brand-100 bg-brand-50 text-brand-600">
                    {mod.icon}
                  </div>
                  <div className="mt-4 text-base font-semibold text-zinc-900">{mod.title}</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">{mod.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ░░ WHY (Producto) ░░ */}
          <section id="sec-producto" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] py-[clamp(32px,4vw,56px)]">
            <div className="max-w-[640px]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">Por qué Andiko</div>
              <h2 className="mt-3 text-[clamp(26px,3vw,32px)] font-semibold leading-[1.12] tracking-[-0.02em] text-zinc-900">
                Software de gestión que entiende cómo trabaja una pyme acá
              </h2>
            </div>
            <div className="mt-[38px] grid grid-cols-[repeat(auto-fit,minmax(268px,1fr))] gap-[18px]">
              {reasons.map((reason) => (
                <div key={reason.title} className="rounded-xl border border-zinc-200/70 bg-white/60 p-[26px]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-brand-100 bg-brand-50 text-brand-600">
                    {reason.icon}
                  </div>
                  <div className="mt-4 text-[17px] font-semibold text-zinc-900">{reason.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{reason.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ░░ METRICS + SECTORS ░░ */}
          <section className="mx-auto max-w-[1200px] px-[clamp(20px,5vw,56px)] py-[clamp(32px,4vw,48px)]">
            <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-[clamp(24px,3vw,36px)] shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[22px]">
                {metrics.map((metric) => (
                  <div key={metric.label} className="text-center">
                    <div className="font-mono text-[clamp(26px,3vw,34px)] font-medium tracking-[-0.02em] text-brand-600">
                      {metric.value}
                    </div>
                    <div className="mt-1.5 text-[13px] text-zinc-600">{metric.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-[30px] border-t border-zinc-200/70 pt-[26px]">
                <div className="mb-4 text-center text-xs text-zinc-400">
                  Pensado para pymes de 40 a 200 personas en
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {sectors.map((sector) => (
                    <span
                      key={sector}
                      className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-zinc-600"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ░░ EARLY ACCESS (Precios) ░░ */}
          <section id="sec-precios" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] py-[clamp(32px,4vw,56px)]">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-[linear-gradient(150deg,#0C647A_0%,#0A5268_55%,#083F52_100%)] p-[clamp(34px,5vw,56px)] shadow-[0_24px_60px_-26px_rgba(8,63,82,0.55)]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_80%_0%,#000,transparent_70%)]"
              />
              <div className="relative flex flex-wrap items-center justify-between gap-7">
                <div className="min-w-[280px] flex-1 basis-[380px]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Precios</div>
                  <h2 className="mt-3 text-[clamp(24px,2.6vw,30px)] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
                    Estamos en beta privada
                  </h2>
                  <p className="mt-3 max-w-[40em] text-[15px] leading-relaxed text-brand-100">
                    El acceso anticipado es sin costo durante el período de beta. Después, planes por
                    módulo en ARS, claros y sin sorpresas. Sumate a la lista y arrancá antes que el
                    resto.
                  </p>
                </div>
                <a
                  href="#sec-contacto"
                  className="inline-flex h-[46px] flex-shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[4px] bg-white px-6 text-[15px] font-semibold text-brand-700 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(0,0,0,0.24)]"
                >
                  Quiero el acceso anticipado
                  <ArrowRight />
                </a>
              </div>
            </div>
          </section>

          {/* ░░ CONTACT ░░ */}
          <section id="sec-contacto" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] pb-[clamp(48px,6vw,88px)] pt-[clamp(40px,5vw,72px)]">
            <div className="mx-auto max-w-[480px]">
              <div className="mb-[26px] text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">Contacto</div>
                <h2 className="mt-3 text-[clamp(24px,2.6vw,30px)] font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-900">
                  Mantenete al tanto
                </h2>
                <p className="mt-2.5 text-[15px] leading-relaxed text-zinc-600">
                  Dejanos tus datos y te avisamos cuando abramos el acceso. Sin spam.
                </p>
              </div>
              <ContactForm />
            </div>
          </section>

          {/* ░░ FOOTER ░░ */}
          <footer className="border-t border-zinc-200/60 bg-white/40 backdrop-blur-sm">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-[18px] px-[clamp(20px,5vw,56px)] py-7">
              <div className="flex items-center gap-2.5">
                <AndikoLogo href="" size="sm" />
                <span className="ml-2 text-[13px] text-zinc-500">© {new Date().getFullYear()} Andiko</span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-[22px]">
                <a href="#sec-producto" className="text-[13px] text-zinc-600 transition-colors hover:text-brand-600">Producto</a>
                <a href="#sec-modulos" className="text-[13px] text-zinc-600 transition-colors hover:text-brand-600">Módulos</a>
                <a href="#sec-contacto" className="text-[13px] text-zinc-600 transition-colors hover:text-brand-600">Contacto</a>
                <span className="font-mono text-[10px] text-zinc-400">ARCA · ARS · CUIT</span>
                <AppVersion />
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
