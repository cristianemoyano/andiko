import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { AppVersion } from '@/components/layout/AppVersion'
import { createPageMetadata, siteConfig, siteUrl } from '@/lib/site'
import { ContactForm } from './ContactForm'

export const metadata = createPageMetadata({
  title: `${siteConfig.title} | ${siteConfig.tagline}`,
  description: siteConfig.description,
  path: '/',
})

const featureItems = [
  {
    label: 'Facturación y cobranzas',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 3h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Stock y alertas de inventario',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 3v18M3.5 8.5L12 13l8.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Compras y cuentas por pagar',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M6 6h15l-1.5 9h-12L6 6z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    ),
  },
  {
    label: 'Contabilidad y documentos fiscales',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M8 4h8a2 2 0 012 2v14H6V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" />
      </svg>
    ),
  },
] as const

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

export default async function ComingSoonPage() {
  const session = await auth()
  if (session) redirect('/panel')

  return (
    <>
      <LandingJsonLd />

      <div className="relative flex min-h-full flex-col overflow-hidden bg-[#F7FBFC]">
        {/* Background layers */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#EEF8FA_0%,#FFFFFF_42%,#F7FBFC_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(12,100,122,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(12,100,122,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,black,transparent)]"
        />
        <div
          aria-hidden
          className="landing-orb pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="landing-orb landing-orb-delay pointer-events-none absolute -right-16 bottom-32 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[18%] h-px w-[min(720px,88vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-300/60 to-transparent"
        />

        <header className="landing-enter relative z-10 px-6 py-6 sm:px-10">
          <AndikoLogo />
        </header>

        <main
          id="contenido-principal"
          className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-4 text-center sm:px-10"
        >
          <p className="landing-enter landing-enter-delay-1 mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm shadow-brand-100/40 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            <span className="landing-badge-shimmer">{siteConfig.tagline}</span>
          </p>

          <h1 className="landing-enter landing-enter-delay-2 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
            El ERP pensado para{' '}
            <span className="bg-gradient-to-r from-brand-700 via-brand-500 to-brand-400 bg-clip-text text-transparent">
              pymes argentinas
            </span>
          </h1>

          <p className="landing-enter landing-enter-delay-3 mt-6 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
            Dejá atrás las planillas y los sistemas que no se hablan entre sí.
            Andiko concentra ventas, stock, compras y finanzas en un flujo simple,
            pensado para la operatoria diaria de tu pyme.
          </p>

          <section
            aria-labelledby="modulos-heading"
            className="landing-enter landing-enter-delay-4 mt-12 w-full max-w-3xl"
          >
            <h2 id="modulos-heading" className="sr-only">
              Módulos del ERP
            </h2>
            <ul className="grid gap-3 text-left sm:grid-cols-2">
              {featureItems.map((item) => (
                <li
                  key={item.label}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200/70 bg-white/65 px-4 py-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-brand-100/60"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-brand-100/0 transition-all duration-300 group-hover:from-brand-50/80 group-hover:to-transparent"
                  />
                  <div className="relative flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:border-brand-200 group-hover:bg-brand-100">
                      {item.icon}
                    </div>
                    <span className="pt-1.5 text-sm font-medium leading-snug text-zinc-700">
                      {item.label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <ContactForm />
        </main>

        <footer className="relative z-10 flex flex-col items-center gap-2 border-t border-zinc-200/60 bg-white/40 px-6 py-6 text-center text-xs text-zinc-500 backdrop-blur-sm sm:px-10">
          <span>© {new Date().getFullYear()} Andiko</span>
          <AppVersion />
        </footer>
      </div>
    </>
  )
}
