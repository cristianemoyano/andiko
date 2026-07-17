import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { LandingHeader } from '@/components/layout/LandingHeader'
import { LandingReveal } from '@/components/layout/LandingReveal'
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

const InstagramIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)

const FacebookIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14C17.174 2.097 15.943 2 14.643 2 11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4z" />
  </svg>
)

const socialLinks = [
  { label: 'Instagram de Andiko', href: siteConfig.social.instagram, Icon: InstagramIcon },
  { label: 'Facebook de Andiko', href: siteConfig.social.facebook, Icon: FacebookIcon },
] as const

const navLinks = [
  { label: 'Producto', href: '#sec-producto' },
  { label: 'Módulos', href: '#sec-modulos' },
  { label: 'Descargar POS', href: '#sec-pos' },
  { label: 'Precios', href: '#sec-precios' },
  { label: 'Contacto', href: '#sec-contacto' },
] as const

const WindowsIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7.2H3v6.1ZM11.7 4.2 21 3v8.5h-9.3V4.2Zm0 16.6L21 21.9V12.5h-9.3v8.3Z" />
  </svg>
)

const AppleIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const DownloadIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
)

const landingPrimaryCta =
  'inline-flex items-center gap-2.5 whitespace-nowrap rounded-[4px] bg-brand-600 font-semibold text-white shadow-[0_2px_8px_rgba(12,100,122,0.28)] transition-[color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:bg-brand-700 active:translate-y-0 active:scale-[0.98]'

const landingSecondaryCta =
  'inline-flex items-center whitespace-nowrap rounded-[4px] border border-zinc-300 bg-white font-semibold text-zinc-900 transition-[color,transform,border-color,background-color] duration-150 ease-out hover:border-zinc-400 hover:bg-zinc-100 active:scale-[0.98]'

const landingInverseCta =
  'inline-flex items-center gap-2.5 whitespace-nowrap rounded-[4px] bg-white font-semibold text-brand-700 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(0,0,0,0.24)] active:translate-y-0 active:scale-[0.98]'

const trustItems = ['Sin tarjeta de crédito', 'Onboarding guiado', 'Instalable en el celular'] as const

const modules = [
  {
    title: 'Contactos',
    body: 'Clientes y proveedores con datos fiscales, cuenta corriente e historial de operaciones en un solo lugar.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Catálogo y precios',
    body: 'Productos, categorías, listas de precios y etiquetas. Un catálogo central que alimenta ventas, stock y POS.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="5" x="3" y="4" rx="1" />
        <rect width="18" height="5" x="3" y="12" rx="1" />
        <path d="M7 7h.01" />
        <path d="M7 15h.01" />
      </svg>
    ),
  },
  {
    title: 'Ventas y facturación',
    body: 'Presupuestos, pedidos y facturas con emisión fiscal. Notas de crédito, débito, devoluciones y cobranzas.',
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
    body: 'Control de stock por depósito y sucursal, remitos, movimientos y alertas de reposición con trazabilidad completa.',
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
    title: 'Contabilidad y fiscal',
    body: 'Libro diario, plan de cuentas, balance e IVA listos para tu contador. Sin exportar a planillas ni rehacer la carga.',
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
  {
    title: 'POS (punto de venta)',
    body: 'Cajas, medios de pago y emisión fiscal en mostrador. Misma base de productos, clientes y stock que el resto del sistema.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h.01" />
        <path d="M10 15h4" />
      </svg>
    ),
  },
] as const

const reasons = [
  {
    title: 'Fiscal listo de fábrica',
    body: 'La facturación electrónica y los circuitos fiscales vienen integrados. No adaptás software genérico a la fuerza.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Un solo sistema',
    body: 'Basta de planillas e integraciones frágiles. Los módulos comparten clientes, productos y comprobantes, siempre.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
        <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
        <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      </svg>
    ),
  },
  {
    title: 'Oficina y mostrador',
    body: 'Operá desde el navegador o instalá la app en el celular. Misma data, mismos permisos, en escritorio y en el piso de venta.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <rect width="8" height="14" x="15" y="5" rx="1.5" />
        <path d="M19 17h.01" />
      </svg>
    ),
  },
] as const

const metrics = [
  { value: 'Modular', label: 'activá lo que necesitás' },
  { value: '1', label: 'sistema para todo' },
  { value: 'Multi', label: 'sucursal y depósito' },
  { value: 'Fiscal', label: 'facturación nativa' },
] as const

const sectors = ['Retail y comercios', 'Distribución y mayoristas', 'Servicios', 'Industria y manufactura'] as const

const [featuredReason, ...secondaryReasons] = reasons

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
        sameAs: [siteConfig.social.instagram, siteConfig.social.facebook],
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
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/#pos`,
        name: 'Andiko POS',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Windows, macOS',
        description: 'Punto de venta de escritorio para Windows y macOS, integrado con Andiko.',
        inLanguage: siteConfig.language,
        softwareVersion: siteConfig.posDownloads.version,
        downloadUrl: siteConfig.posDownloads.releasesUrl,
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
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
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(12,100,122,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(12,100,122,0.025)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_28%,#000_0%,transparent_78%)]"
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
          <LandingHeader navLinks={navLinks} primaryCtaClass={landingPrimaryCta} />

          {/* ░░ HERO ░░ */}
          <section className="mx-auto max-w-[1200px] px-[clamp(20px,5vw,56px)] pb-[clamp(28px,4vw,48px)] pt-[clamp(40px,6vw,84px)]">
            <div className="flex flex-wrap items-center gap-[clamp(36px,5vw,64px)]">
              {/* Left copy */}
              <div className="min-w-[320px] flex-1 basis-[440px]">
                <div className="landing-enter inline-flex items-center gap-2.5 rounded-full border border-brand-200 bg-white/70 py-1.5 pl-3 pr-3.5 shadow-sm shadow-brand-600/[0.06] backdrop-blur-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-brand-500" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
                    {siteConfig.tagline} · Beta privada
                  </span>
                </div>

                <h1 className="landing-enter landing-enter-delay-1 mt-[22px] text-[clamp(34px,4.6vw,55px)] font-semibold leading-[1.04] tracking-[-0.025em] text-zinc-900 text-balance">
                  Gestioná tu negocio con{' '}
                  <span className="text-brand-700">Andiko</span>
                </h1>

                <p className="landing-enter landing-enter-delay-2 mt-5 max-w-[30em] text-base leading-relaxed text-zinc-600">
                  Contactos, catálogo, ventas, stock, compras, contabilidad y POS en un solo flujo.
                  Facturación electrónica, multisucursal y pensado para cómo trabaja tu negocio —
                  sin planillas ni integraciones frágiles.
                </p>

                <div className="landing-enter landing-enter-delay-3 mt-[30px] flex flex-wrap gap-3">
                  <a href="#sec-contacto" className={`${landingPrimaryCta} h-11 px-[22px] text-[15px]`}>
                    Quiero probarlo
                    <ArrowRight />
                  </a>
                  <a href="#sec-modulos" className={`${landingSecondaryCta} h-11 px-5 text-[15px]`}>
                    Ver módulos
                  </a>
                </div>

                <div className="landing-enter landing-enter-delay-3 mt-[22px] flex flex-wrap gap-[18px]">
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
              <div className="landing-enter landing-enter-delay-4 group min-w-[320px] flex-1 basis-[500px]">
                <DashboardMockup className="transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_28px_70px_-20px_rgba(12,100,122,0.34)]" />
              </div>
            </div>
          </section>

          {/* decorative line */}
          <div className="mx-auto h-px max-w-[1100px] bg-gradient-to-r from-transparent via-brand-300/60 to-transparent" />

          <LandingReveal>
            <section id="sec-modulos" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] pb-[clamp(32px,4vw,56px)] pt-[clamp(56px,7vw,96px)]">
              <div className="max-w-[640px]">
                <h2 className="text-[clamp(26px,3vw,32px)] font-semibold leading-[1.12] tracking-[-0.02em] text-zinc-900">
                  Un módulo para cada parte de tu operación
                </h2>
                <p className="mt-3.5 text-base leading-relaxed text-zinc-600">
                  Módulos integrados que comparten clientes, productos y comprobantes. Activás lo
                  que necesitás y todo conversa entre sí.
                </p>
              </div>
              <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(252px,1fr))] gap-[18px]">
                {modules.map((mod, index) => (
                  <LandingReveal
                    key={mod.title}
                    delay={Math.min(index, 4) as 0 | 1 | 2 | 3 | 4}
                    className="rounded-xl border border-zinc-200/70 bg-white/70 p-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-[3px] hover:border-brand-200 hover:shadow-[0_14px_34px_rgba(208,238,243,0.7)]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-brand-100 bg-brand-50 text-brand-600">
                      {mod.icon}
                    </div>
                    <div className="mt-4 text-base font-semibold text-zinc-900">{mod.title}</div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">{mod.body}</p>
                  </LandingReveal>
                ))}
              </div>
            </section>
          </LandingReveal>

          {/* ░░ POS DOWNLOADS ░░ */}
          <LandingReveal>
            <section id="sec-pos" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] pb-[clamp(32px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
              <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-[clamp(26px,4vw,36px)] shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div className="min-w-[260px] max-w-[520px] flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
                      Andiko POS · v{siteConfig.posDownloads.version}
                    </p>
                    <h2 className="mt-2 text-[clamp(24px,2.8vw,30px)] font-semibold leading-[1.12] tracking-[-0.02em] text-zinc-900">
                      Descargá el punto de venta
                    </h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">
                      App de escritorio para la caja: funciona offline, sincroniza con el ERP y comparte
                      el mismo catálogo, clientes y stock.
                    </p>
                  </div>
                  <div className="flex flex-col items-stretch gap-3 sm:items-end">
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={siteConfig.posDownloads.windows}
                        className={`${landingPrimaryCta} h-11 px-5 text-[15px]`}
                        download
                      >
                        <WindowsIcon />
                        Windows
                        <DownloadIcon className="h-[15px] w-[15px] opacity-80" />
                      </a>
                      <a
                        href={siteConfig.posDownloads.macAppleSilicon}
                        className={`${landingSecondaryCta} h-11 gap-2.5 px-5 text-[15px]`}
                        download
                      >
                        <AppleIcon />
                        macOS
                        <DownloadIcon className="h-[15px] w-[15px] opacity-70" />
                      </a>
                    </div>
                    <p className="text-[12px] leading-relaxed text-zinc-500 sm:text-right">
                      macOS es para Apple Silicon.{' '}
                      <a
                        href={siteConfig.posDownloads.macIntel}
                        className="font-medium text-brand-700 underline-offset-2 hover:underline"
                        download
                      >
                        Descargar para Intel
                      </a>
                      {' · '}
                      <a
                        href={siteConfig.posDownloads.releasesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-700 underline-offset-2 hover:underline"
                      >
                        Todas las versiones
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </LandingReveal>

          {/* ░░ WHY (Producto) ░░ */}
          <LandingReveal>
            <section id="sec-producto" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] py-[clamp(32px,4vw,56px)]">
            <div className="max-w-[640px]">
              <h2 className="text-[clamp(26px,3vw,32px)] font-semibold leading-[1.12] tracking-[-0.02em] text-zinc-900">
                Software de gestión que entiende cómo trabaja una pyme
              </h2>
            </div>
            <div className="mt-[38px] grid gap-[18px] lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200/70 border-l-4 border-l-brand-500 bg-white/80 p-[clamp(26px,4vw,34px)] lg:row-span-2 lg:flex lg:flex-col lg:justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-brand-100 bg-brand-50 text-brand-600">
                  {featuredReason.icon}
                </div>
                <div className="mt-5 text-[clamp(18px,2vw,22px)] font-semibold text-zinc-900">{featuredReason.title}</div>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">{featuredReason.body}</p>
              </div>
              {secondaryReasons.map((reason) => (
                <div
                  key={reason.title}
                  className="rounded-xl border border-zinc-200/70 bg-white/60 p-[22px] transition-[border-color,background-color] duration-150 ease-out hover:border-brand-200/80 hover:bg-white/80"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-brand-100 bg-brand-50 text-brand-600">
                    {reason.icon}
                  </div>
                  <div className="mt-4 text-[17px] font-semibold text-zinc-900">{reason.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{reason.body}</p>
                </div>
              ))}
            </div>
            </section>
          </LandingReveal>

          {/* ░░ METRICS + SECTORS ░░ */}
          <LandingReveal>
            <section className="mx-auto max-w-[1200px] px-[clamp(20px,5vw,56px)] py-[clamp(20px,3vw,32px)]">
            <div className="rounded-xl border border-zinc-200/70 bg-white/70 px-[clamp(20px,3vw,28px)] py-[clamp(18px,2.5vw,24px)] shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {metrics.map((metric) => (
                  <div key={metric.label} className="text-center">
                    <div className="font-mono text-[clamp(22px,2.5vw,28px)] font-medium tracking-[-0.02em] text-brand-600">
                      {metric.value}
                    </div>
                    <div className="mt-1 text-[12px] text-zinc-600">{metric.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col items-center gap-3 border-t border-zinc-200/60 pt-4 sm:flex-row sm:flex-wrap sm:justify-center">
                <span className="text-center text-xs text-zinc-400 sm:text-left">
                  Pensado para pymes de 40 a 200 personas en
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {sectors.map((sector) => (
                    <span
                      key={sector}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            </section>
          </LandingReveal>

          {/* ░░ EARLY ACCESS (Precios) ░░ */}
          <LandingReveal>
            <section id="sec-precios" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] py-[clamp(32px,4vw,56px)]">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-[linear-gradient(150deg,#0C647A_0%,#0A5268_55%,#083F52_100%)] p-[clamp(34px,5vw,56px)] shadow-[0_24px_60px_-26px_rgba(8,63,82,0.55)]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_80%_0%,#000,transparent_70%)]"
              />
              <div className="relative flex flex-wrap items-center justify-between gap-7">
                <div className="min-w-[280px] flex-1 basis-[380px]">
                  <h2 className="text-[clamp(24px,2.6vw,30px)] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
                    Estamos en beta privada
                  </h2>
                  <p className="mt-3 max-w-[40em] text-[15px] leading-relaxed text-brand-100">
                    El acceso anticipado es sin costo durante el período de beta. Después, planes por
                    módulo, claros y sin sorpresas. Sumate a la lista y arrancá antes que el resto.
                  </p>
                </div>
                <a href="#sec-contacto" className={`${landingInverseCta} h-[46px] flex-shrink-0 px-6 text-[15px]`}>
                  Quiero el acceso anticipado
                  <ArrowRight />
                </a>
              </div>
            </div>
            </section>
          </LandingReveal>

          {/* ░░ CONTACT ░░ */}
          <LandingReveal>
            <section id="sec-contacto" className="mx-auto max-w-[1200px] scroll-mt-20 px-[clamp(20px,5vw,56px)] pb-[clamp(48px,6vw,88px)] pt-[clamp(40px,5vw,72px)]">
            <div className="mx-auto max-w-[480px]">
              <div className="mb-[26px] text-center">
                <h2 className="text-[clamp(24px,2.6vw,30px)] font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-900">
                  Mantenete al tanto
                </h2>
                <p className="mt-2.5 text-[15px] leading-relaxed text-zinc-600">
                  Dejanos tus datos y te avisamos cuando abramos el acceso. Sin spam.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-[13px] text-zinc-500">Seguinos</span>
                  <div className="flex items-center gap-1" aria-label="Redes sociales">
                    {socialLinks.map(({ label, href, Icon }) => (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-zinc-500 transition-[color,background-color] duration-150 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <Icon />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              <ContactForm />
            </div>
            </section>
          </LandingReveal>

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
                <a href="#sec-pos" className="text-[13px] text-zinc-600 transition-colors hover:text-brand-600">Descargar POS</a>
                <a href="#sec-contacto" className="text-[13px] text-zinc-600 transition-colors hover:text-brand-600">Contacto</a>
                <div className="flex items-center gap-1.5" aria-label="Redes sociales">
                  {socialLinks.map(({ label, href, Icon }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-zinc-500 transition-[color,background-color] duration-150 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Icon />
                    </a>
                  ))}
                </div>
                <span className="font-mono text-[10px] text-zinc-400">Ventas · Stock · POS</span>
                <AppVersion />
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
