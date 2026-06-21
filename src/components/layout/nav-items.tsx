export interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

export const NAV_MAIN: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Panel',
    href: '/panel',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
        <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
      </svg>
    ),
  },
]

export const NAV_MODULES: NavItem[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    href: '/ventas',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1z"/><path d="M9 1v5h5M5 9h6M5 12h4"/>
      </svg>
    ),
  },
  {
    id: 'inventario',
    label: 'Inventario',
    href: '/inventario',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 4l6-2 6 2v8l-6 2-6-2V4z"/><path d="M8 2v12M2 4l6 2 6-2"/>
      </svg>
    ),
  },
  {
    id: 'compras',
    label: 'Compras',
    href: '/compras',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M1 1h2l2 8h7l2-5H5"/><circle cx="7" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    href: '/contabilidad',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 14h12M4 14V9M8 14V5M12 14V9"/>
      </svg>
    ),
  },
  {
    id: 'contactos',
    label: 'Contactos',
    href: '/contactos',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-2.76 2.24-5 5-5h0c2.76 0 5 2.24 5 5"/><circle cx="12" cy="5" r="2"/><path d="M11 10c1.5 0 4 .9 4 2.5v1.5"/>
      </svg>
    ),
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    href: '/catalogo',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1" y="2" width="14" height="3" rx="0.5"/><rect x="1" y="7" width="14" height="3" rx="0.5"/><rect x="1" y="12" width="14" height="2" rx="0.5"/>
      </svg>
    ),
  },
]

export const NAV_SYSTEM: NavItem[] = [
  {
    id: 'configuracion',
    label: 'Configuración',
    href: '/configuracion',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.2 3.2l.7.7M12.1 12.1l.7.7M3.2 12.8l.7-.7M12.1 3.9l.7-.7"/>
      </svg>
    ),
  },
]

export { isModuleNavVisible } from '@/lib/nav-module-access'
