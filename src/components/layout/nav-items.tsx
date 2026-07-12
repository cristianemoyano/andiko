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
  {
    id: 'documentos-compartidos',
    label: 'Compartidos con vos',
    href: '/documentos/compartidos',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6l-4-4H6z"/>
        <path d="M6 2v4h4M8 10l2-2 2 2"/>
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
    id: 'logistica',
    label: 'Logística',
    href: '/logistica',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 3h8v8H1zM9 6h3l3 3v2h-3"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="12.5" r="1.5"/>
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
  {
    id: 'automatizaciones',
    label: 'Automatizaciones',
    href: '/automatizaciones',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.2 1.5 4.5 8.5H8l-1.3 6 5.8-7H9.2z"/>
      </svg>
    ),
  },
]

export const NAV_WOOCOMMERCE: NavItem = {
  id: 'integraciones-woocommerce',
  label: 'WooCommerce',
  href: '/integraciones/woocommerce',
  icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12v10H2z"/><path d="M2 6h12M5 9h2M9 9h2"/>
    </svg>
  ),
}

export const NAV_SYSTEM: NavItem[] = [
  {
    id: 'configuracion',
    label: 'Configuración',
    href: '/configuracion',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
]

export { isModuleNavVisible } from '@/lib/nav-module-access'
