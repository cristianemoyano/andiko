/**
 * Hero dashboard mockup — a dense, realistic preview of the Andiko ERP panel.
 * Decorative only (aria-hidden); recreated from the marketing landing design.
 */

const navItems = [
  { label: 'Panel', active: true, icon: (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ) },
  { label: 'Ventas', active: false, icon: (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  ) },
  { label: 'Inventario', active: false, icon: (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ) },
  { label: 'Compras', active: false, icon: (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h14l-1.5 9.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  ) },
  { label: 'Contabilidad', active: false, icon: (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
    </svg>
  ) },
  { label: 'Contactos', active: false, icon: (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  ) },
] as const

const kpis = [
  { label: 'Facturado (mes)', value: '$ 1.842.300', note: '+12% vs mes anterior', noteClass: 'text-green-600' },
  { label: 'Cobrado (mes)', value: '$ 1.204.500', note: '65% del facturado', noteClass: 'text-zinc-500' },
  { label: 'Compras pend.', value: '3', note: 'por aprobar', noteClass: 'text-amber-600' },
  { label: 'Stock bajo', value: '7 productos', note: 'bajo punto de pedido', noteClass: 'text-amber-600' },
] as const

const invoices = [
  { number: 'FC-A 0001-00004532', customer: 'Distribuidora Sur S.A.', amount: '$ 45.980,00', status: 'Aprobado', statusClass: 'bg-green-100 text-green-900' },
  { number: 'FC-A 0001-00004531', customer: 'Importaciones Nortex', amount: '$ 15.004,00', status: 'Pendiente', statusClass: 'bg-amber-100 text-amber-900' },
  { number: 'FC-B 0001-00000089', customer: 'Mercado del Sur', amount: '$ 7.018,00', status: 'En proceso', statusClass: 'bg-brand-100 text-brand-800' },
] as const

export function DashboardMockup() {
  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-[14px] border border-zinc-200/85 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-18px_rgba(12,100,122,0.28)]"
    >
      {/* window chrome */}
      <div className="flex items-center gap-[7px] border-b border-zinc-100 bg-[#FBFCFD] px-3.5 py-[11px]">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="ml-2.5 font-mono text-[11px] text-zinc-400">app.andiko.com.ar/panel</span>
      </div>

      <div className="flex h-[372px]">
        {/* sidebar */}
        <div className="flex w-[152px] flex-shrink-0 flex-col gap-0.5 border-r border-zinc-100 bg-white px-2.5 py-3">
          <div className="flex items-center gap-2 px-1.5 pb-3 pt-0.5">
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-brand-600">
              <svg viewBox="0 0 12 12" className="h-[11px] w-[11px] fill-white">
                <rect x="0" y="1" width="2.4" height="10" />
                <rect x="9.6" y="1" width="2.4" height="10" />
                <rect x="0" y="1" width="12" height="2.4" />
                <rect x="2" y="6" width="8" height="1.9" />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-tight text-zinc-900">andiko</span>
          </div>
          {navItems.map((item) => (
            <div
              key={item.label}
              className={
                item.active
                  ? 'flex items-center gap-[9px] rounded-[5px] bg-brand-50 px-[9px] py-[7px] text-xs font-semibold text-brand-700'
                  : 'flex items-center gap-[9px] rounded-[5px] px-[9px] py-[7px] text-xs text-zinc-600'
              }
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>

        {/* content */}
        <div className="flex-1 overflow-hidden bg-zinc-50 p-3.5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Panel general</div>
              <div className="mt-px text-[11px] text-zinc-500">19 de abril de 2026 · Ejercicio 2026</div>
            </div>
            <div className="flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-[4px] bg-brand-600 px-2.5 text-[11px] font-semibold text-white">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Crear factura
            </div>
          </div>

          {/* KPIs */}
          <div className="mb-2.5 grid grid-cols-2 gap-2">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-[4px] border border-zinc-200 bg-white px-[11px] py-[9px]">
                <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{kpi.label}</div>
                <div className="mt-1 font-mono text-base font-medium text-zinc-900">{kpi.value}</div>
                <div className={`mt-0.5 text-[10px] ${kpi.noteClass}`}>{kpi.note}</div>
              </div>
            ))}
          </div>

          {/* mini table */}
          <div className="overflow-hidden rounded-[4px] border border-zinc-200 bg-white">
            <div className="flex items-center border-b border-zinc-100 px-[11px] py-2">
              <span className="whitespace-nowrap text-[11px] font-semibold text-zinc-900">Facturas recientes</span>
              <span className="ml-auto text-[10px] text-brand-600">Ver todas →</span>
            </div>
            {invoices.map((inv, i) => (
              <div
                key={inv.number}
                className={`flex items-center px-[11px] py-[7px] ${i < invoices.length - 1 ? 'border-b border-zinc-100/80' : ''}`}
              >
                <span className="w-[122px] font-mono text-[10px] text-zinc-700">{inv.number}</span>
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-zinc-900">{inv.customer}</span>
                <span className="mr-2.5 flex-shrink-0 whitespace-nowrap font-mono text-[11px] font-medium text-zinc-900">{inv.amount}</span>
                <span className={`flex-shrink-0 whitespace-nowrap rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold ${inv.statusClass}`}>{inv.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
