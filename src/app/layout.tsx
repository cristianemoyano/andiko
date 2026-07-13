import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

import { AppToaster } from '@/components/layout/AppToaster'
import { CookieConsentBanner } from '@/components/layout/CookieConsentBanner'
import { UmamiAnalytics } from '@/components/layout/UmamiAnalytics'
import { ThemeInitScript } from '@/components/layout/ThemeInitScript'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import { siteConfig, siteUrl } from '@/lib/site'

import './globals.css'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteConfig.title,
    template: '%s — Andiko',
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: siteConfig.name,
  },
  icons: {
    icon: [
      { url: '/brand/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
    shortcut: '/brand/favicon-32.png',
  },
  keywords: [
    'ERP',
    'pymes',
    'facturación electrónica',
    'inventario',
    'contabilidad',
    'ventas',
    'compras',
    'software de gestión',
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Cover the full screen (incl. notch areas) so `env(safe-area-inset-*)`
  // resolves when running as an installed standalone PWA.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)', color: '#18181B' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeInitScript />
        <style dangerouslySetInnerHTML={{ __html: 'body{background:#FAFAFA}@media(prefers-color-scheme:dark){body{background:#18181B}}' }} />
        {children}
        <CookieConsentBanner />
        <UmamiAnalytics />
        <AppToaster />
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
