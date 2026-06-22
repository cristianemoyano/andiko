import { AndikoMark } from './AndikoMark'

/** Future: replace default branding when cloud-served promos are available. */
export type PosTicketPromo = {
  imageUrl?: string | null
  title: string
  body?: string | null
  href?: string | null
}

function DefaultBranding() {
  return (
    <>
      <AndikoMark size="lg" />
      <div className="mt-4 text-center max-w-xs px-2">
        <div className="text-xl font-semibold text-zinc-800 tracking-tight">
          <span className="text-brand-600">Andiko</span> ERP
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
          Gestión integrada para tu comercio.
        </p>
      </div>
    </>
  )
}

function PromoContent({ promo }: { promo: PosTicketPromo }) {
  const inner = (
    <div className="flex flex-col items-center text-center max-w-lg">
      {promo.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={promo.imageUrl}
          alt=""
          className="max-h-32 w-auto rounded-lg object-contain mb-4"
        />
      ) : null}
      <div className="text-xl font-semibold text-zinc-800">{promo.title}</div>
      {promo.body ? (
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">{promo.body}</p>
      ) : null}
    </div>
  )

  if (promo.href) {
    return (
      <a
        href={promo.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group rounded-xl transition-colors hover:bg-zinc-50/80 px-4 py-2 -mx-4"
      >
        {inner}
      </a>
    )
  }

  return inner
}

/**
 * Fills unused checkout sidebar space with Andiko ERP branding.
 * Pass `promo` later for sponsored or cloud-managed placements.
 */
export function PosTicketBrandPanel({ promo = null }: { promo?: PosTicketPromo | null }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-0 px-6 py-8 overflow-hidden"
      aria-hidden={promo ? undefined : true}
    >
      {promo ? <PromoContent promo={promo} /> : <DefaultBranding />}
    </div>
  )
}
