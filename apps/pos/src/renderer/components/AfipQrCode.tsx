import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type AfipQrCodeProps = {
  value: string
  /** Pixel size for thermal ticket (default 120). */
  size?: number
}

/** Renders AFIP QR as inline SVG — avoids CSP blocking data: URLs in Electron. */
export function AfipQrCode({ value, size = 120 }: AfipQrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(value.trim(), {
      type: 'svg',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((markup) => {
        if (!cancelled) setSvg(markup)
      })
      .catch(() => {
        if (!cancelled) {
          setSvg(null)
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (failed || !svg) {
    return (
      <div
        className="mx-auto mb-2 flex items-center justify-center border border-black/25 bg-white text-[8px] text-black/45"
        style={{ width: size, height: size }}
        aria-label={failed ? 'No se pudo generar el QR AFIP' : 'Generando código QR AFIP'}
      >
        QR AFIP
      </div>
    )
  }

  return (
    <div
      className="mx-auto mb-2 flex justify-center bg-white [&>svg]:block"
      style={{ width: size, height: size }}
      // SVG is generated locally from the AFIP URL — not user HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="Código QR AFIP"
    />
  )
}
