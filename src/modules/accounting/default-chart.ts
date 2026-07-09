// Pure data module (no server-only / sequelize): safe to import from both the
// accounts service and DB migrations. Defines the default Argentine PyME chart
// of accounts seeded for every new organization.

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const
export type AccountType = typeof ACCOUNT_TYPES[number]

export interface DefaultAccount {
  code: string
  name: string
  type: AccountType
  /** Parent account code, or null for top-level accounts. */
  parent_code: string | null
  /** Only postable (imputable) leaf accounts can receive journal lines. */
  is_postable: boolean
}

/**
 * Plan de cuentas base para PyMEs argentinas.
 * Ordenado jerárquicamente (los padres siempre preceden a sus hijos) para que
 * el sembrado pueda resolver `parent_id` por código en una sola pasada.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  // 1 — ACTIVO
  { code: '1', name: 'Activo', type: 'asset', parent_code: null, is_postable: false },
  { code: '1.1', name: 'Activo Corriente', type: 'asset', parent_code: '1', is_postable: false },
  { code: '1.1.01', name: 'Caja y Bancos', type: 'asset', parent_code: '1.1', is_postable: false },
  { code: '1.1.01.01', name: 'Caja', type: 'asset', parent_code: '1.1.01', is_postable: true },
  { code: '1.1.01.02', name: 'Banco Cuenta Corriente', type: 'asset', parent_code: '1.1.01', is_postable: true },
  { code: '1.1.02', name: 'Créditos', type: 'asset', parent_code: '1.1', is_postable: false },
  { code: '1.1.02.01', name: 'Deudores por ventas', type: 'asset', parent_code: '1.1.02', is_postable: true },
  { code: '1.1.02.02', name: 'IVA Crédito Fiscal', type: 'asset', parent_code: '1.1.02', is_postable: true },
  { code: '1.1.02.03', name: 'Anticipos a proveedores', type: 'asset', parent_code: '1.1.02', is_postable: true },
  { code: '1.1.03', name: 'Bienes de Cambio', type: 'asset', parent_code: '1.1', is_postable: false },
  { code: '1.1.03.01', name: 'Mercaderías', type: 'asset', parent_code: '1.1.03', is_postable: true },
  { code: '1.2', name: 'Activo No Corriente', type: 'asset', parent_code: '1', is_postable: false },
  { code: '1.2.01', name: 'Bienes de Uso', type: 'asset', parent_code: '1.2', is_postable: false },
  { code: '1.2.01.01', name: 'Rodados', type: 'asset', parent_code: '1.2.01', is_postable: true },
  { code: '1.2.01.02', name: 'Muebles y Útiles', type: 'asset', parent_code: '1.2.01', is_postable: true },
  { code: '1.2.01.03', name: 'Equipos de computación', type: 'asset', parent_code: '1.2.01', is_postable: true },
  { code: '1.2.01.99', name: 'Amortización acumulada bienes de uso', type: 'asset', parent_code: '1.2.01', is_postable: true },

  // 2 — PASIVO
  { code: '2', name: 'Pasivo', type: 'liability', parent_code: null, is_postable: false },
  { code: '2.1', name: 'Pasivo Corriente', type: 'liability', parent_code: '2', is_postable: false },
  { code: '2.1.01', name: 'Deudas Comerciales', type: 'liability', parent_code: '2.1', is_postable: false },
  { code: '2.1.01.01', name: 'Proveedores', type: 'liability', parent_code: '2.1.01', is_postable: true },
  { code: '2.1.02', name: 'Deudas Fiscales', type: 'liability', parent_code: '2.1', is_postable: false },
  { code: '2.1.02.01', name: 'IVA Débito Fiscal', type: 'liability', parent_code: '2.1.02', is_postable: true },
  { code: '2.1.02.02', name: 'IVA a pagar', type: 'liability', parent_code: '2.1.02', is_postable: true },
  { code: '2.1.02.03', name: 'Retenciones a pagar', type: 'liability', parent_code: '2.1.02', is_postable: true },
  { code: '2.1.02.04', name: 'Impuestos a pagar', type: 'liability', parent_code: '2.1.02', is_postable: true },
  { code: '2.1.03', name: 'Deudas Sociales', type: 'liability', parent_code: '2.1', is_postable: false },
  { code: '2.1.03.01', name: 'Sueldos a pagar', type: 'liability', parent_code: '2.1.03', is_postable: true },
  { code: '2.1.03.02', name: 'Cargas sociales a pagar', type: 'liability', parent_code: '2.1.03', is_postable: true },
  { code: '2.1.04', name: 'Deudas Bancarias', type: 'liability', parent_code: '2.1', is_postable: false },
  { code: '2.1.04.01', name: 'Préstamos bancarios', type: 'liability', parent_code: '2.1.04', is_postable: true },

  // 3 — PATRIMONIO NETO
  { code: '3', name: 'Patrimonio Neto', type: 'equity', parent_code: null, is_postable: false },
  { code: '3.1', name: 'Capital', type: 'equity', parent_code: '3', is_postable: false },
  { code: '3.1.01', name: 'Capital social', type: 'equity', parent_code: '3.1', is_postable: true },
  { code: '3.2', name: 'Resultados', type: 'equity', parent_code: '3', is_postable: false },
  { code: '3.2.01', name: 'Resultados no asignados', type: 'equity', parent_code: '3.2', is_postable: true },
  { code: '3.2.02', name: 'Resultado del ejercicio', type: 'equity', parent_code: '3.2', is_postable: true },

  // 4 — INGRESOS
  { code: '4', name: 'Ingresos', type: 'income', parent_code: null, is_postable: false },
  { code: '4.1', name: 'Ingresos por ventas', type: 'income', parent_code: '4', is_postable: false },
  { code: '4.1.01', name: 'Ventas', type: 'income', parent_code: '4.1', is_postable: true },
  { code: '4.1.02', name: 'Descuentos cedidos', type: 'income', parent_code: '4.1', is_postable: true },
  { code: '4.2', name: 'Otros ingresos', type: 'income', parent_code: '4', is_postable: false },
  { code: '4.2.01', name: 'Ingresos financieros', type: 'income', parent_code: '4.2', is_postable: true },

  // 5 — EGRESOS
  { code: '5', name: 'Egresos', type: 'expense', parent_code: null, is_postable: false },
  { code: '5.1', name: 'Costo de ventas', type: 'expense', parent_code: '5', is_postable: false },
  { code: '5.1.01', name: 'Costo de mercaderías vendidas', type: 'expense', parent_code: '5.1', is_postable: true },
  { code: '5.2', name: 'Gastos', type: 'expense', parent_code: '5', is_postable: false },
  { code: '5.2.01', name: 'Gastos de comercialización', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.2.02', name: 'Gastos de administración', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.2.03', name: 'Sueldos y jornales', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.2.04', name: 'Cargas sociales', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.2.05', name: 'Alquileres', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.2.06', name: 'Servicios', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.2.07', name: 'Impuestos y tasas', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.2.08', name: 'Amortizaciones', type: 'expense', parent_code: '5.2', is_postable: true },
  { code: '5.3', name: 'Gastos financieros', type: 'expense', parent_code: '5', is_postable: false },
  { code: '5.3.01', name: 'Intereses pagados', type: 'expense', parent_code: '5.3', is_postable: true },
  { code: '5.3.02', name: 'Comisiones bancarias', type: 'expense', parent_code: '5.3', is_postable: true },
]

/** Códigos del plan default usados por auto-post de ventas/compras. */
export const AUTO_POST_ACCOUNT_CODES = {
  sales:      '4.1.01',
  ivaDebit:   '2.1.02.01',
  receivable: '1.1.02.01',
  ivaCredit:  '1.1.02.02',
  inventory:  '1.1.03.01',
  payable:    '2.1.01.01',
  cogs:       '5.1.01',
  cash:       '1.1.01.01',
  bank:       '1.1.01.02',
} as const

export const REQUIRED_AUTO_POST_CODES = [
  ...new Set(Object.values(AUTO_POST_ACCOUNT_CODES)),
] as const
