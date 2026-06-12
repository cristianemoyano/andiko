import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/site'

export const alt = siteConfig.title
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #EEF8FA 0%, #FFFFFF 55%, #D0EEF3 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: 12,
              background: '#0C647A',
            }}
          >
            <svg viewBox="0 0 12 12" width="36" height="36" fill="#FFFFFF">
              <rect x="0" y="1" width="3" height="10" />
              <rect x="0" y="1" width="12" height="3" />
              <rect x="9" y="1" width="3" height="10" />
              <rect x="2" y="5" width="8" height="2.5" />
            </svg>
          </div>
          <span style={{ fontSize: 48, fontWeight: 700, color: '#18181B', letterSpacing: '-0.02em' }}>
            andiko
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              borderRadius: 999,
              border: '2px solid #A2DCE7',
              background: '#EEF8FA',
              color: '#0C647A',
              fontSize: 22,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Próximamente
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#18181B',
              letterSpacing: '-0.03em',
            }}
          >
            ERP para pymes argentinas
          </h1>
          <p style={{ margin: 0, fontSize: 28, lineHeight: 1.4, color: '#52525B' }}>
            Ventas, stock, compras y finanzas en un solo lugar.
          </p>
        </div>
      </div>
    ),
    { ...size },
  )
}
