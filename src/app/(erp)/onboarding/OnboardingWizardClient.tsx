'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fetchLandingPath } from '@/lib/landing-path-client'
import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { AndikoMark } from '@/components/layout/AndikoMark'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { formatCuit } from '@/modules/contacts/contact.utils'
import type { OnboardingData } from '@/modules/auth/organization.model'
import {
  ORG_MODULE_DEFS,
  BASE_TIER_MODULES,
  type OrgModuleKey,
} from '@/modules/auth/organization-modules'
import { TablePagination } from '@/components/erp'
import {
  AfipCertificadoSection,
  AfipConfigSection,
  AfipPuntosDeVentaSection,
} from '@/components/erp/afip'
import { Select } from '@/components/primitives/Select'
import { DEFAULT_ORG_ROLE_TEMPLATES, getBuiltinRoleLabel } from '@/modules/auth/role-labels'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface WizardStep {
  id: string
  label: string
  time: string | null
  optional: boolean
}

interface ProductRow {
  nombre: string
  sku: string
  precio: string
  categoria: string
  stock: string
}

interface ContactDraft {
  legalName: string
  cuit: string
  email: string
  phone: string
  ivaCondition: 'responsable_inscripto' | 'monotributista' | 'consumidor_final' | 'exento' | 'no_responsable'
}

const EMPTY_CONTACT_DRAFT: ContactDraft = {
  legalName: '',
  cuit: '',
  email: '',
  phone: '',
  ivaCondition: 'responsable_inscripto',
}

const IVA_CONDITION_OPTIONS = [
  { value: 'responsable_inscripto', label: 'Responsable inscripto' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'consumidor_final', label: 'Consumidor final' },
  { value: 'exento', label: 'Exento' },
  { value: 'no_responsable', label: 'No responsable' },
] as const

const CONTACT_PANEL_CONFIG = {
  clientes: {
    contactType: 'customer' as const,
    label: 'cliente',
    plural: 'clientes',
    legalNamePlaceholder: 'Ej: Supermercados Norte S.A.',
  },
  proveedores: {
    contactType: 'supplier' as const,
    label: 'proveedor',
    plural: 'proveedores',
    legalNamePlaceholder: 'Ej: Distribuidora Mayorista S.A.',
  },
}

const ONBOARDING_CONTACTS_PAGE_SIZE = 10

const CONTACT_IVA_LABEL: Record<string, string> = {
  responsable_inscripto: 'Resp. Inscripto',
  monotributista: 'Monotributista',
  consumidor_final: 'Cons. Final',
  exento: 'Exento',
  no_responsable: 'No responsable',
}

interface OnboardingContactRow {
  id: string
  legal_name: string
  cuit: string | null
  iva_condition: string
  email: string | null
  phone: string | null
}

function OnboardingContactsTable({
  contactType,
  plural,
  refresh,
}: {
  contactType: 'customer' | 'supplier'
  plural: string
  refresh: number
}) {
  const [contacts, setContacts] = useState<OnboardingContactRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const title = plural.charAt(0).toUpperCase() + plural.slice(1)

  const [listKey, setListKey] = useState({ contactType, refresh })
  if (listKey.contactType !== contactType || listKey.refresh !== refresh) {
    setListKey({ contactType, refresh })
    setPage(1)
  }

  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading before async fetch is the standard pattern here
    setLoading(true)
    setLoadError(null)

    const params = new URLSearchParams({
      page: String(page),
      limit: String(ONBOARDING_CONTACTS_PAGE_SIZE),
      type: contactType,
    })

    fetchJson<{ data: OnboardingContactRow[]; total: number }>(`/api/v1/contacts?${params}`)
      .then((data) => {
        if (!mounted) return
        setContacts(data.data ?? [])
        setTotal(data.total ?? 0)
        const pages = Math.max(1, Math.ceil((data.total ?? 0) / ONBOARDING_CONTACTS_PAGE_SIZE))
        if (page > pages) setPage(pages)
      })
      .catch((err) => {
        if (!mounted) return
        setLoadError(getApiErrorMessage(err))
        setContacts([])
        setTotal(0)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [contactType, page, refresh])

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border bg-teal-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-teal-800/80">
          {title} cargados
        </h3>
        {!loading && total > 0 ? (
          <span className="text-[11px] text-teal-800/70 tabular-nums">{total} en total</span>
        ) : null}
      </div>

      {loadError ? (
        <p role="alert" className="mx-4 my-3 rounded-sm border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">
          {loadError}
        </p>
      ) : null}

      {loading && contacts.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-fg-muted">Cargando {plural}…</div>
      ) : contacts.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-fg-muted">
          Todavía no hay {plural} cargados.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse table-fixed">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-surface-muted/60">
                  {['Razón social', 'CUIT', 'Condición IVA', 'Email', 'Teléfono'].map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-fg-muted whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-border last:border-b-0 transition-colors hover:bg-teal-50/30 even:bg-surface-muted/30"
                  >
                    <td className="px-3 py-2.5 text-xs font-medium text-fg">{contact.legal_name}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-fg-muted">{contact.cuit ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-fg-muted">
                      {CONTACT_IVA_LABEL[contact.iva_condition] ?? contact.iva_condition}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-fg-muted truncate">{contact.email ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-fg-muted whitespace-nowrap">{contact.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border bg-surface-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-fg-muted tabular-nums">
              Mostrando {contacts.length} de {total}
            </span>
            <TablePagination
              page={page}
              pageSize={ONBOARDING_CONTACTS_PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  )
}

interface UserRow {
  email: string
  firstName: string
  lastName: string
  rol: string
}

interface WizardData extends OnboardingData {
  products?: ProductRow[]
  users?: UserRow[]
  contacts?: {
    clientMode: string | null
    provMode: string | null
  }
}

interface Props {
  orgId: string
  userEmail: string
  userName: string
  initialData?: OnboardingData
  isRevisit?: boolean
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const STEPS: WizardStep[] = [
  { id: 'welcome',      label: 'Bienvenida',              time: null,    optional: false },
  { id: 'company',      label: 'Datos de empresa',         time: '3 min', optional: false },
  { id: 'modules',      label: 'Módulos',                  time: '2 min', optional: false },
  { id: 'products',     label: 'Productos',                time: '5 min', optional: false },
  { id: 'contacts',     label: 'Clientes y proveedores',   time: '3 min', optional: true  },
  { id: 'sales',        label: 'Ventas y facturación',     time: '3 min', optional: false },
  { id: 'integrations', label: 'Integraciones',            time: '2 min', optional: true  },
  { id: 'users',        label: 'Usuarios y roles',         time: '2 min', optional: true  },
  { id: 'done',         label: 'Listo',                    time: null,    optional: false },
]

const MODULE_DESCRIPTIONS: Record<OrgModuleKey, string> = {
  contacts: 'Clientes y proveedores',
  catalog: 'Productos y listas de precios',
  sales: 'Facturas, presupuestos y cobros',
  inventory: 'Stock, depósitos y movimientos',
  purchases: 'Órdenes de compra y recepción',
  accounting: 'Libro diario, asientos e informes',
  pos: 'Cajas, turnos y punto de venta',
  automations: 'Tareas recurrentes y automatizaciones',
  expenses: 'Gastos únicos, recurrentes y planes en cuotas',
  hr: 'Legajos de empleados y control de horario',
}

const INTEGRATIONS = [
  { id: 'email',         label: 'Servidor de email (SMTP)',   desc: 'Enviá facturas y presupuestos directamente por email.',            category: 'Comunicación',   recommended: false, available: true },
  { id: 'mercadolibre',  label: 'Mercado Libre',              desc: 'Sincronización de catálogo, stock y pedidos.',                     category: 'E-commerce',     recommended: false, available: false },
  { id: 'tiendanube',    label: 'Tienda Nube',                desc: 'Integración bidireccional de inventario, órdenes y clientes.',     category: 'E-commerce',     recommended: false, available: false },
  { id: 'woocommerce',   label: 'WooCommerce',                desc: 'Conectá tu tienda WordPress a través de API REST.',                category: 'E-commerce',     recommended: false, available: true },
  { id: 'mercadopago',   label: 'Mercado Pago',               desc: 'Conciliación automática de cobros y link de pago en facturas.',    category: 'Pagos',          recommended: false, available: false },
] as const

const template = (name: string) => DEFAULT_ORG_ROLE_TEMPLATES.find(t => t.name === name)

const ROLES = [
  {
    id: 'admin',
    label: getBuiltinRoleLabel('admin'),
    desc: 'Acceso completo a todos los módulos y configuración de la empresa',
    ownerOnly: true,
  },
  {
    id: 'branch-admin',
    label: getBuiltinRoleLabel('branch-admin'),
    desc: 'Gestión operativa de una sucursal: ventas, caja, stock y usuarios de esa ubicación',
  },
  {
    id: 'vendedor',
    label: 'Vendedor',
    desc: template('Vendedor')?.description ?? 'Presupuestos, facturas y clientes',
  },
  {
    id: 'cajero',
    label: 'Cajero',
    desc: template('Cajero')?.description ?? 'Ventas en punto de venta y cobros',
  },
  {
    id: 'comprador',
    label: 'Gerente de compras',
    desc: template('Gerente de compras')?.description ?? 'Compras, proveedores y recepción',
  },
  {
    id: 'contador',
    label: 'Contador',
    desc: template('Contador')?.description ?? 'Contabilidad, reportes e impuestos',
  },
  {
    id: 'deposito',
    label: 'Depósito',
    desc: template('Depósito')?.description ?? 'Movimientos de stock e inventario',
  },
  {
    id: 'solo_lectura',
    label: getBuiltinRoleLabel('readonly'),
    desc: 'Puede ver pero no modificar ningún registro',
  },
]

const INVITABLE_ROLES = ROLES.filter(r => !('ownerOnly' in r && r.ownerOnly))

const PROVINCIAS = [
  'Buenos Aires','CABA','Córdoba','Santa Fe','Mendoza','Tucumán','Entre Ríos',
  'Salta','Misiones','Chaco','Corrientes','Santiago del Estero','San Juan',
  'Jujuy','Río Negro','Neuquén','Formosa','Chubut','San Luis','Catamarca',
  'La Rioja','La Pampa','Santa Cruz','Tierra del Fuego',
]

// ─── ICONS ───────────────────────────────────────────────────────────────────

function IcoCheck({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 7l3 3 6-6" />
    </svg>
  )
}

function IcoArrow({ size = 14, dir = 'right', color = 'currentColor' }: { size?: number; dir?: 'left' | 'right'; color?: string }) {
  const d = dir === 'right' ? 'M3 7h8M8 4l3 3-3 3' : 'M11 7H3M6 4L3 7l3 3'
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function IcoPlus({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round">
      <path d="M7 3v8M3 7h8" />
    </svg>
  )
}

function IcoUpload({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V4M5 7l3-3 3 3M3 13h10" />
    </svg>
  )
}

function IcoX({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round">
      <path d="M2 2l8 8M10 2l-8 8" />
    </svg>
  )
}

function IcoLink({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a3 3 0 0 0 4.5.3l2-2a3 3 0 0 0-4.2-4.3L7 3.3" />
      <path d="M10 8a3 3 0 0 0-4.5-.3l-2 2a3 3 0 0 0 4.2 4.3L9 12.7" />
    </svg>
  )
}

// ─── SHARED PRIMITIVES ────────────────────────────────────────────────────────

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <div className="text-base font-semibold text-fg tracking-tight">{children}</div>
      {sub && <div className="text-sm text-fg-muted mt-1 leading-relaxed">{sub}</div>}
    </div>
  )
}

function OnboardingFormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border bg-teal-50/60 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-teal-800/80">
          {title}
        </h3>
      </div>
      <div className="p-4 md:p-5 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-fg-muted mb-1">
      {children}
      {required && <span className="text-danger ml-0.5">*</span>}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-fg-subtle mt-1">{children}</p>
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-danger mt-1">{children}</p>
}

function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      {children}
      {hint && !error && <FieldHint>{hint}</FieldHint>}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

const inputCls = (error?: string) =>
  `w-full h-9 md:h-[34px] px-2.5 text-base md:text-[13px] text-fg bg-surface border rounded-sm outline-none transition-colors
   ${error ? 'border-danger focus:border-danger focus:ring-2 focus:ring-red-200' : 'border-border-strong focus:border-teal-600 focus:ring-2 focus:ring-teal-100'}`

const selectCls = (error?: string) =>
  `w-full h-9 md:h-[34px] px-2.5 text-base md:text-[13px] text-fg bg-surface border rounded-sm outline-none appearance-none transition-colors
   ${error ? 'border-danger focus:border-danger focus:ring-2 focus:ring-red-200' : 'border-border-strong focus:border-teal-600 focus:ring-2 focus:ring-teal-100'}`

function InfoBanner({
  children,
  variant = 'teal',
  className = '',
}: {
  children: React.ReactNode
  variant?: 'teal' | 'amber'
  className?: string
}) {
  const cls =
    variant === 'teal'
      ? 'bg-teal-50 border-teal-200 text-teal-800'
      : 'bg-warning-bg border-warning text-warning'
  return (
    <div className={`flex gap-2.5 items-start p-3 border rounded-sm text-xs leading-relaxed ${cls} ${className}`}>
      <svg
        width={14} height={14} viewBox="0 0 14 14" fill="none"
        stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
        className="flex-shrink-0 mt-0.5"
      >
        <circle cx="7" cy="7" r="6" />
        <path d="M7 5v2.5M7 9.5v.5" />
      </svg>
      <span>{children}</span>
    </div>
  )
}

function Badge({ children, color = 'zinc' }: { children: React.ReactNode; color?: 'zinc' | 'teal' | 'amber' | 'green' }) {
  const map = {
    zinc:  'bg-surface-hover text-fg-muted border-border-strong',
    teal:  'bg-teal-50 text-teal-700 border-teal-200',
    amber: 'bg-warning-bg text-warning border-warning',
    green: 'bg-success-bg text-success border-success',
  }
  return (
    <span className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-sm border whitespace-nowrap ${map[color]}`}>
      {children}
    </span>
  )
}

function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  size = 'md',
  full = false,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'teal'
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  type?: 'button' | 'submit'
}) {
  const base =
    'inline-flex items-center gap-1.5 font-medium rounded-sm border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'text-xs h-7 px-2.5',
    md: 'text-[13px] h-[34px] px-3.5',
    lg: 'text-sm h-10 px-4.5',
  }
  const variants = {
    primary:   'bg-teal-600 hover:bg-teal-700 text-white border-transparent',
    secondary: 'bg-surface hover:bg-surface-muted text-fg border-border-strong',
    ghost:     'bg-transparent hover:bg-surface-hover text-fg-muted border-transparent',
    teal:      'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${full ? 'w-full justify-center' : ''}`}
    >
      {children}
    </button>
  )
}

// ─── PROGRESS RAIL ────────────────────────────────────────────────────────────

function ProgressRail({
  currentStep,
  completedSteps,
  onJump,
  allowAllSteps = false,
}: {
  currentStep: number
  completedSteps: string[]
  onJump: (idx: number) => void
  allowAllSteps?: boolean
}) {
  const displaySteps = STEPS.filter(s => s.id !== 'done')
  const pct = Math.round((completedSteps.length / displaySteps.length) * 100)

  return (
    <div className="hidden md:flex w-[220px] flex-shrink-0 bg-surface border-r border-border flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border flex items-center">
        <AndikoLogo href="/" size="xs" />
      </div>

      {/* Progress summary */}
      <div className="px-5 py-3.5 border-b border-border">
        <div className="text-[11px] font-semibold text-fg-subtle uppercase tracking-widest mb-1">
          Configuración inicial
        </div>
        <div className="h-1 bg-surface-hover rounded-sm overflow-hidden">
          <div
            className="h-full bg-teal-600 rounded-sm transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] text-fg-subtle mt-1.5">
          {completedSteps.length} de {displaySteps.length} pasos completados
        </div>
      </div>

      {/* Steps */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {displaySteps.map((step, idx) => {
          const stepIdx = STEPS.findIndex(s => s.id === step.id)
          const isActive = STEPS[currentStep]?.id === step.id
          const isDone = completedSteps.includes(step.id)
          const isAccessible = allowAllSteps || isDone || stepIdx <= currentStep + 1
          return (
            <button
              key={step.id}
              onClick={() => isAccessible && onJump(stepIdx)}
              disabled={!isAccessible}
              className={`w-full flex items-center gap-2.5 px-5 py-[7px] text-left transition-colors
                ${isActive ? 'bg-teal-50' : isAccessible ? 'hover:bg-surface-hover' : ''}
                ${isAccessible ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* Indicator */}
              <div
                className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border transition-all
                  ${isDone || isActive ? 'bg-teal-600 border-teal-600' : 'bg-surface-hover border-border-strong'}`}
              >
                {isDone ? (
                  <IcoCheck size={10} color="#fff" />
                ) : (
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-fg-subtle'}`}>
                    {idx + 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs truncate ${isActive ? 'font-medium text-teal-700' : isDone ? 'text-fg-muted' : 'text-fg-muted'}`}
                >
                  {step.label}
                </div>
                {step.optional && (
                  <div className="text-[10px] text-fg-subtle">Opcional</div>
                )}
              </div>
              {step.time && !isDone && (
                <span className="text-[10px] text-fg-subtle flex-shrink-0">{step.time}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border">
        <p className="text-[11px] text-fg-subtle">
          Tiempo estimado: <span className="font-medium text-fg-muted">~15 min</span>
        </p>
      </div>
    </div>
  )
}

// ─── STEP WRAPPER ─────────────────────────────────────────────────────────────

function StepWrapper({
  children,
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Continuar',
  canSkip = false,
  canNext = true,
  isFirst = false,
  isLast = false,
  contentClassName,
}: {
  children: React.ReactNode
  onNext: () => void
  onBack?: () => void
  onSkip?: () => void
  nextLabel?: string
  canSkip?: boolean
  canNext?: boolean
  isFirst?: boolean
  isLast?: boolean
  contentClassName?: string
}) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className={`flex-1 px-4 md:px-10 py-6 md:py-8 w-full mx-auto ${contentClassName ?? 'max-w-[680px]'}`}>
        {children}
      </div>
      {!isLast && (
        <div className="border-t border-border px-4 md:px-10 py-3.5 flex flex-wrap items-center gap-2.5 bg-surface flex-shrink-0">
          {!isFirst && onBack && (
            <Btn variant="secondary" onClick={onBack}>
              <IcoArrow dir="left" size={13} color="#3F3F46" />
              Atrás
            </Btn>
          )}
          <div className="flex-1" />
          {canSkip && onSkip && (
            <Btn variant="ghost" onClick={onSkip}>
              Omitir por ahora
            </Btn>
          )}
          <Btn variant="primary" onClick={onNext} disabled={!canNext}>
            {nextLabel}
            <IcoArrow dir="right" size={13} color="#fff" />
          </Btn>
        </div>
      )}
    </div>
  )
}

// ─── STEP 0: WELCOME ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <StepWrapper onNext={onNext} isFirst nextLabel="Comenzar configuración">
      <div className="text-center pt-5">
        <div className="flex justify-center mb-6">
          <AndikoMark size="2xl" />
        </div>
        <h1 className="text-[22px] font-semibold text-fg tracking-tight mb-2.5">
          Bienvenido a Andiko
        </h1>
        <p className="text-sm text-fg-muted leading-relaxed max-w-[460px] mx-auto mb-8">
          En los próximos minutos vas a configurar tu empresa y dejar el sistema listo para operar. Podés completar los pasos ahora o volver más tarde.
        </p>

        <div className="w-full max-w-[440px] mx-auto mb-8 rounded-lg border border-border bg-surface shadow-sm overflow-hidden text-left">
          <div className="border-b border-border bg-teal-50/60 px-4 py-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-teal-800/80">
              En esta configuración
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {[
              'Datos de tu empresa y condición fiscal',
              'Módulos que vas a usar (podés cambiarlos después)',
              'Productos, clientes y proveedores',
              'Configuración de ventas y facturación AFIP',
              'Integraciones y usuarios del sistema',
            ].map((text) => (
              <li
                key={text}
                className="flex items-start gap-3 px-4 py-3 transition-colors even:bg-surface-muted/30 hover:bg-teal-50/30"
              >
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50">
                  <IcoCheck size={10} color="#0C647A" />
                </div>
                <span className="text-[13px] leading-snug text-fg">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-1.5 justify-center">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5L8 8" />
          </svg>
          <span className="text-xs text-fg-subtle">Tiempo estimado: 15 minutos</span>
        </div>
      </div>
    </StepWrapper>
  )
}

// ─── STEP 1: COMPANY ─────────────────────────────────────────────────────────

function StepCompany({
  onNext,
  onBack,
  data,
  setData,
}: {
  onNext: () => void
  onBack: () => void
  data: WizardData
  setData: (fn: (prev: WizardData) => WizardData) => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const d = data.company ?? {}

  const set = (key: string, val: string) =>
    setData(prev => ({ ...prev, company: { ...(prev.company ?? {}), [key]: val } }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!d.razonSocial?.trim()) e.razonSocial = 'Campo requerido'
    if (!d.cuit?.trim()) e.cuit = 'Campo requerido'
    else if (!/^\d{2}-\d{8}-\d$/.test(d.cuit)) e.cuit = 'Formato: XX-XXXXXXXX-X'
    if (!d.condicionIVA) e.condicionIVA = 'Campo requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <StepWrapper
      onNext={() => { if (validate()) onNext() }}
      onBack={onBack}
    >
      <SectionTitle sub="Esta información se usa para emitir comprobantes y configurar tu cuenta fiscal.">
        Datos de tu empresa
      </SectionTitle>

      <div className="flex flex-col gap-5">
        <OnboardingFormSection title="Identificación fiscal">
          <FormField label="Razón social" required error={errors.razonSocial}>
            <input
              type="text"
              className={inputCls(errors.razonSocial)}
              value={d.razonSocial ?? ''}
              onChange={e => set('razonSocial', e.target.value)}
              placeholder="Ej: Distribuidora Sur S.A."
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="CUIT" required hint="Formato: 30-12345678-9" error={errors.cuit}>
              <input
                type="text"
                className={`${inputCls(errors.cuit)} font-mono`}
                value={d.cuit ?? ''}
                onChange={e => set('cuit', e.target.value)}
                placeholder="30-12345678-9"
              />
            </FormField>
            <FormField label="Condición frente al IVA" required error={errors.condicionIVA}>
              <select
                className={selectCls(errors.condicionIVA)}
                value={d.condicionIVA ?? ''}
                onChange={e => set('condicionIVA', e.target.value)}
              >
                <option value="">Seleccioná...</option>
                <option value="responsable_inscripto">Responsable inscripto</option>
                <option value="monotributo">Monotributo</option>
                <option value="exento">Exento</option>
                <option value="no_alcanzado">No alcanzado</option>
              </select>
            </FormField>
          </div>
        </OnboardingFormSection>

        <OnboardingFormSection title="Datos comerciales">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nombre comercial" hint="Opcional — si difiere de la razón social">
              <input
                type="text"
                className={inputCls()}
                value={d.nombreComercial ?? ''}
                onChange={e => set('nombreComercial', e.target.value)}
                placeholder="Ej: Distribuidora Sur"
              />
            </FormField>
            <FormField label="Actividad principal">
              <select
                className={selectCls()}
                value={d.actividad ?? ''}
                onChange={e => set('actividad', e.target.value)}
              >
                <option value="">Seleccioná...</option>
                <option value="comercio">Comercio al por mayor/menor</option>
                <option value="servicios">Servicios</option>
                <option value="industria">Industria / Manufactura</option>
                <option value="construccion">Construcción</option>
                <option value="agro">Agropecuario</option>
                <option value="otro">Otro</option>
              </select>
            </FormField>
          </div>
        </OnboardingFormSection>

        <OnboardingFormSection title="Domicilio fiscal">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Calle y número">
              <input
                type="text"
                className={inputCls()}
                value={d.calle ?? ''}
                onChange={e => set('calle', e.target.value)}
                placeholder="Ej: Av. Corrientes 1234"
              />
            </FormField>
            <FormField label="Ciudad">
              <input
                type="text"
                className={inputCls()}
                value={d.ciudad ?? ''}
                onChange={e => set('ciudad', e.target.value)}
                placeholder="Ej: Buenos Aires"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Provincia">
              <select
                className={selectCls()}
                value={d.provincia ?? ''}
                onChange={e => set('provincia', e.target.value)}
              >
                <option value="">Seleccioná...</option>
                {PROVINCIAS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Código postal">
              <input
                type="text"
                className={inputCls()}
                value={d.cp ?? ''}
                onChange={e => set('cp', e.target.value)}
                placeholder="Ej: C1043"
              />
            </FormField>
            <FormField label="País">
              <input
                type="text"
                className={inputCls()}
                value={d.pais ?? 'Argentina'}
                onChange={e => set('pais', e.target.value)}
              />
            </FormField>
          </div>
        </OnboardingFormSection>

        <OnboardingFormSection title="Contacto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Teléfono">
              <input
                type="tel"
                className={inputCls()}
                value={d.telefono ?? ''}
                onChange={e => set('telefono', e.target.value)}
                placeholder="+54 11 1234-5678"
              />
            </FormField>
            <FormField label="Email de contacto">
              <input
                type="email"
                className={inputCls()}
                value={d.email ?? ''}
                onChange={e => set('email', e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </FormField>
          </div>
        </OnboardingFormSection>
      </div>
    </StepWrapper>
  )
}

// ─── STEP 2: MODULES ─────────────────────────────────────────────────────────

function ModuleToggleCard({
  mod,
  tier,
  isOn,
  onToggle,
}: {
  mod: (typeof ORG_MODULE_DEFS)[number]
  tier: 'base' | 'premium'
  isOn: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left shadow-sm transition-all sm:p-4 ${
        isOn
          ? 'border-teal-300 bg-teal-50/80'
          : 'border-border bg-surface hover:border-teal-200 hover:bg-teal-50/20'
      }`}
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm ${
          isOn ? 'bg-teal-100' : 'bg-surface-hover'
        }`}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
          stroke={isOn ? '#0C647A' : '#71717A'}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="12" height="12" rx="1" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className={`text-[13px] font-medium ${isOn ? 'text-teal-800' : 'text-fg'}`}>
            {mod.label}
          </span>
          {tier === 'base' ? <Badge color="teal">Recomendado</Badge> : <Badge color="amber">Premium</Badge>}
          {isOn ? <Badge color="green">Activado</Badge> : null}
        </div>
        <p className="text-[12px] leading-snug text-fg-muted">{MODULE_DESCRIPTIONS[mod.key]}</p>
      </div>
      <div
        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border transition-all ${
          isOn ? 'border-teal-600 bg-teal-600' : 'border-border-strong bg-surface'
        }`}
      >
        {isOn ? <IcoCheck size={9} color="#fff" /> : null}
      </div>
    </button>
  )
}

function StepModules({
  onNext,
  onBack,
  data,
  setData,
}: {
  onNext: () => void
  onBack: () => void
  data: WizardData
  setData: (fn: (prev: WizardData) => WizardData) => void
}) {
  const selected = (data.modules ?? BASE_TIER_MODULES) as OrgModuleKey[]

  const toggle = (id: OrgModuleKey) => {
    const next = selected.includes(id) ? selected.filter(m => m !== id) : [...selected, id]
    setData(prev => ({ ...prev, modules: next }))
  }

  const baseModules = ORG_MODULE_DEFS.filter(m => m.tier === 'base')
  const premiumModules = ORG_MODULE_DEFS.filter(m => m.tier === 'premium')

  return (
    <StepWrapper onNext={onNext} onBack={onBack} canNext={selected.length > 0}>
      <SectionTitle sub="Activá los módulos que tu empresa va a usar. Podés habilitarlos o deshabilitarlos en cualquier momento desde Organización.">
        Módulos del sistema
      </SectionTitle>

      <div className="flex flex-col gap-5">
        {(['base', 'premium'] as const).map(tier => (
          <OnboardingFormSection
            key={tier}
            title={tier === 'base' ? 'Módulos base' : 'Módulos premium'}
          >
            <p className="text-[12px] leading-relaxed text-fg-muted -mt-1 mb-1">
              {tier === 'base'
                ? 'Incluidos en el plan base. Recomendamos mantenerlos activos para operar.'
                : 'Funcionalidades avanzadas que podés activar según las necesidades de tu empresa.'}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(tier === 'base' ? baseModules : premiumModules).map(mod => (
                <ModuleToggleCard
                  key={mod.key}
                  mod={mod}
                  tier={tier}
                  isOn={selected.includes(mod.key)}
                  onToggle={() => toggle(mod.key)}
                />
              ))}
            </div>
          </OnboardingFormSection>
        ))}
      </div>

      {selected.length === 0 && (
        <p className="mt-4 text-xs text-danger">Seleccioná al menos un módulo para continuar.</p>
      )}

      <InfoBanner variant="teal" className="mt-6">
        Los módulos seleccionados determinan qué opciones aparecen en el menú principal. Comenzamos con los módulos{' '}
        <strong>base</strong> activados por defecto.
      </InfoBanner>
    </StepWrapper>
  )
}

// ─── STEP 3: PRODUCTS ─────────────────────────────────────────────────────────

function StepProducts({
  onNext,
  onBack,
  onSkip,
  data,
  setData,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  data: WizardData
  setData: (fn: (prev: WizardData) => WizardData) => void
}) {
  const [mode, setMode] = useState<string | null>(data.productsMode ?? null)
  const [products, setProducts] = useState<ProductRow[]>(
    data.products ?? [{ nombre: '', sku: '', precio: '', categoria: '', stock: '' }],
  )
  const [dragOver, setDragOver] = useState(false)

  const addRow = () => setProducts(prev => [...prev, { nombre: '', sku: '', precio: '', categoria: '', stock: '' }])
  const removeRow = (idx: number) => setProducts(prev => prev.filter((_, i) => i !== idx))
  const setCell = (idx: number, key: keyof ProductRow, val: string) => {
    setProducts(prev => prev.map((p, i) => (i === idx ? { ...p, [key]: val } : p)))
  }

  const handleNext = () => {
    setData(prev => ({
      ...prev,
      productsMode: mode as 'manual' | 'csv' | 'later' | null,
      products,
    }))
    onNext()
  }

  const handleSkip = () => {
    setData(prev => ({ ...prev, productsMode: null }))
    onSkip()
  }

  return (
    <StepWrapper
      onNext={handleNext}
      onBack={onBack}
      canSkip
      onSkip={handleSkip}
      canNext={mode !== null}
      contentClassName="max-w-[980px]"
    >
      <SectionTitle sub="Cargá tus productos para poder emitir facturas y llevar el stock desde el primer día.">
        Configuración de productos
      </SectionTitle>

      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: 'manual', label: 'Carga manual',  desc: 'Ingresá productos uno por uno' },
            { id: 'csv',    label: 'Importar CSV',   desc: 'Subí un archivo Excel o CSV'   },
            { id: 'later',  label: 'Más tarde',      desc: 'Comenzar sin productos'        },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setMode(opt.id); setData(prev => ({ ...prev, productsMode: opt.id as 'manual' | 'csv' | 'later' })) }}
              className="flex flex-col items-center p-5 border-[1.5px] border-border rounded bg-surface hover:border-teal-400 hover:bg-teal-50 transition-all text-center"
            >
              <div className="w-9 h-9 bg-surface-hover rounded-sm flex items-center justify-center mb-2.5">
                <IcoPlus size={18} color="#71717A" />
              </div>
              <span className="text-[13px] font-medium text-fg mb-1">{opt.label}</span>
              <span className="text-[11px] text-fg-subtle leading-snug">{opt.desc}</span>
            </button>
          ))}
        </div>
      )}

      {mode === 'manual' && (
        <div>
          <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>
            <IcoArrow dir="left" size={12} color="#71717A" />
            Cambiar método
          </Btn>
          <div className="mt-3.5 rounded-lg border border-border bg-surface shadow-sm overflow-x-auto md:overflow-visible">
            <table className="w-full border-collapse table-fixed min-w-0">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-8" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-teal-50/60">
                  {['Nombre del producto', 'SKU / Código', 'Precio (ARS)', 'Categoría', 'Stock inicial', ''].map(h => (
                    <th
                      key={h || '_actions'}
                      className="px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-teal-800/80 text-left whitespace-nowrap first:rounded-tl-lg last:rounded-tr-lg"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-fg-muted">
                      Todavía no hay productos. Usá el botón de abajo para agregar el primero.
                    </td>
                  </tr>
                ) : (
                  products.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-b-0 transition-colors hover:bg-teal-50/30 even:bg-surface-muted/30"
                    >
                      <td className="p-2">
                        <input
                          type="text"
                          value={p.nombre}
                          onChange={e => setCell(i, 'nombre', e.target.value)}
                          placeholder="Ej: Notebook HP 15"
                          className="w-full text-base md:text-xs h-9 md:h-8 px-2 border border-border rounded-sm bg-surface outline-none transition-colors focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={p.sku}
                          onChange={e => setCell(i, 'sku', e.target.value)}
                          placeholder="NB-HP-15"
                          className="w-full text-base md:text-xs h-9 md:h-8 px-2 border border-border rounded-sm bg-surface font-mono outline-none transition-colors focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={p.precio}
                          onChange={e => setCell(i, 'precio', e.target.value)}
                          placeholder="0,00"
                          className="w-full text-base md:text-xs h-9 md:h-8 px-2 border border-border rounded-sm bg-surface font-mono text-right outline-none transition-colors focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={p.categoria}
                          onChange={e => setCell(i, 'categoria', e.target.value)}
                          placeholder="Electrónica"
                          className="w-full text-base md:text-xs h-9 md:h-8 px-2 border border-border rounded-sm bg-surface outline-none transition-colors focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={p.stock}
                          onChange={e => setCell(i, 'stock', e.target.value)}
                          placeholder="0"
                          className="w-full text-base md:text-xs h-9 md:h-8 px-2 border border-border rounded-sm bg-surface font-mono text-right outline-none transition-colors focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2 w-8">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="flex h-8 w-8 items-center justify-center rounded-sm border border-transparent text-fg-subtle transition-colors hover:border-danger/20 hover:bg-danger/5 hover:text-danger"
                          aria-label="Quitar producto"
                        >
                          <IcoX size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Btn variant="teal" size="sm" onClick={addRow}>
              <IcoPlus size={12} color="#0C647A" />
              Agregar producto
            </Btn>
            {products.length === 0 && (
              <span className="text-[11px] text-fg-muted">También podés cargarlos más tarde desde Inventario.</span>
            )}
          </div>
        </div>
      )}

      {mode === 'csv' && (
        <div>
          <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>
            <IcoArrow dir="left" size={12} color="#71717A" />
            Cambiar método
          </Btn>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false) }}
            className={`mt-3.5 border-2 border-dashed rounded p-10 text-center transition-all
              ${dragOver ? 'border-teal-400 bg-teal-50' : 'border-border-strong bg-surface-muted'}`}
          >
            <IcoUpload size={28} color={dragOver ? '#0C647A' : '#A1A1AA'} />
            <p className="text-sm font-medium text-fg-muted mt-3 mb-1">
              Arrastrá tu archivo CSV o Excel aquí
            </p>
            <p className="text-xs text-fg-subtle mb-4">Formatos aceptados: .csv, .xlsx — hasta 10.000 filas</p>
            <Btn variant="secondary" size="sm">
              <IcoUpload size={12} color="#3F3F46" />
              Seleccionar archivo
            </Btn>
          </div>
          <div className="mt-3 p-2.5 bg-surface-muted border border-border rounded-sm text-xs text-fg-muted">
            Tu archivo debe tener columnas:{' '}
            <code className="font-mono text-fg-muted">nombre, sku, precio, categoria, stock</code>
          </div>
        </div>
      )}

      {mode === 'later' && (
        <div className="p-6 bg-surface-muted border border-border rounded text-center">
          <p className="text-sm font-medium text-fg-muted mb-1">Sin productos por ahora</p>
          <p className="text-xs text-fg-subtle">Podés cargar productos desde Inventario → Productos en cualquier momento.</p>
          <div className="mt-3.5">
            <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>Elegir otro método</Btn>
          </div>
        </div>
      )}
    </StepWrapper>
  )
}

// ─── STEP 4: CONTACTS ─────────────────────────────────────────────────────────

function StepContacts({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const [tab, setTab] = useState<'clientes' | 'proveedores'>('clientes')
  const [clientMode, setClientMode] = useState<string | null>(null)
  const [provMode, setProvMode] = useState<string | null>(null)

  return (
    <StepWrapper
      onNext={onNext}
      onBack={onBack}
      canSkip
      onSkip={onSkip}
      contentClassName="max-w-[980px]"
    >
      <SectionTitle sub="Importá tus clientes y proveedores existentes. Este paso es opcional — podés agregarlos después desde Contactos.">
        Clientes y proveedores
      </SectionTitle>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {(['clientes', 'proveedores'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] capitalize transition-colors border-b-2 -mb-px
              ${tab === t ? 'border-teal-600 text-teal-700 font-medium' : 'border-transparent text-fg-muted hover:text-fg-muted'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className={tab === 'clientes' ? undefined : 'hidden'}>
        <ContactPanel mode={clientMode} setMode={setClientMode} type="clientes" />
      </div>
      <div className={tab === 'proveedores' ? undefined : 'hidden'}>
        <ContactPanel mode={provMode} setMode={setProvMode} type="proveedores" />
      </div>
    </StepWrapper>
  )
}

function ContactPanel({
  mode,
  setMode,
  type,
}: {
  mode: string | null
  setMode: (m: string | null) => void
  type: keyof typeof CONTACT_PANEL_CONFIG
}) {
  const config = CONTACT_PANEL_CONFIG[type]
  const { label, contactType, legalNamePlaceholder } = config
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_CONTACT_DRAFT)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [listRefresh, setListRefresh] = useState(0)

  const [prevMode, setPrevMode] = useState(mode)
  if (mode !== prevMode) {
    setPrevMode(mode)
    if (mode !== 'manual') {
      setDraft(EMPTY_CONTACT_DRAFT)
      setErrors({})
      setServerError(null)
    }
  }

  const setField = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    setServerError(null)
  }

  async function handleSave() {
    const nextErrors: Record<string, string> = {}
    if (!draft.legalName.trim()) {
      nextErrors.legalName = 'Ingresá la razón social o nombre.'
    }
    if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      nextErrors.email = 'Ingresá un email válido.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setErrors({})
    setServerError(null)

    const cuitDigits = draft.cuit.replace(/\D/g, '')
    const cuit = cuitDigits.length === 11 ? formatCuit(cuitDigits) : draft.cuit.trim() ? draft.cuit.trim() : null

    try {
      await fetchJson<{ legal_name: string }>('/api/v1/contacts', {
        method: 'POST',
        body: JSON.stringify({
          type: contactType,
          legal_name: draft.legalName.trim(),
          cuit,
          iva_condition: draft.ivaCondition,
          email: draft.email.trim() || null,
          phone: draft.phone.trim() || null,
        }),
      })
      setListRefresh((r) => r + 1)
      setDraft(EMPTY_CONTACT_DRAFT)
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) {
        const mapped: Record<string, string> = {}
        for (const [key, messages] of Object.entries(fe)) {
          const fieldKey = key === 'legal_name' ? 'legalName'
            : key === 'iva_condition' ? 'ivaCondition'
            : key
          if (messages[0]) mapped[fieldKey] = messages[0]
        }
        setErrors(mapped)
        return
      }
      if (isApiRequestError(err) && err.code === 'DUPLICATE_CUIT') {
        setErrors({ cuit: 'El CUIT ya está registrado en otro contacto.' })
        return
      }
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  let panelContent: React.ReactNode

  if (!mode) {
    panelContent = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { id: 'manual', label: 'Alta manual',  desc: `Ingresá un ${label} ahora`  },
          { id: 'csv',    label: 'Importar CSV',  desc: 'Subí una lista existente'   },
          { id: 'later',  label: 'Después',       desc: 'Agregar desde Contactos'    },
        ].map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMode(opt.id)}
            className="flex flex-col items-center p-5 border-[1.5px] border-border rounded-lg bg-surface shadow-sm hover:border-teal-400 hover:bg-teal-50 transition-all text-center"
          >
            <div className="w-9 h-9 bg-surface-hover rounded-sm flex items-center justify-center mb-2.5">
              {opt.id === 'manual' ? <IcoPlus size={18} color="#71717A" /> : opt.id === 'csv' ? <IcoUpload size={18} color="#71717A" /> : <IcoArrow dir="right" size={18} color="#71717A" />}
            </div>
            <span className="text-[13px] font-medium text-fg mb-1">{opt.label}</span>
            <span className="text-[11px] text-fg-subtle leading-snug">{opt.desc}</span>
          </button>
        ))}
      </div>
    )
  } else if (mode === 'manual') {
    panelContent = (
      <div>
        <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>
          <IcoArrow dir="left" size={12} color="#71717A" />
          Cambiar
        </Btn>
        <div className="mt-3.5 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="border-b border-border bg-teal-50/60 px-4 py-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-teal-800/80">
              Datos del {label}
            </h3>
          </div>
          <div className="p-4 md:p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Razón social / Nombre" required error={errors.legalName}>
                <input
                  type="text"
                  value={draft.legalName}
                  onChange={e => setField('legalName', e.target.value)}
                  className={inputCls(errors.legalName)}
                  placeholder={legalNamePlaceholder}
                  disabled={saving}
                />
              </FormField>
              <FormField label="CUIT / CUIL" hint="XX-XXXXXXXX-X" error={errors.cuit}>
                <input
                  type="text"
                  value={draft.cuit}
                  onChange={e => setField('cuit', e.target.value)}
                  className={`${inputCls(errors.cuit)} font-mono`}
                  placeholder="20-12345678-0"
                  disabled={saving}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email" error={errors.email}>
                <input
                  type="email"
                  value={draft.email}
                  onChange={e => setField('email', e.target.value)}
                  className={inputCls(errors.email)}
                  placeholder="contacto@empresa.com"
                  disabled={saving}
                />
              </FormField>
              <FormField label="Teléfono" error={errors.phone}>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={e => setField('phone', e.target.value)}
                  className={inputCls(errors.phone)}
                  placeholder="+54 11 1234-5678"
                  disabled={saving}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Condición IVA" required error={errors.ivaCondition}>
                <select
                  value={draft.ivaCondition}
                  onChange={e => setField('ivaCondition', e.target.value as ContactDraft['ivaCondition'])}
                  className={selectCls(errors.ivaCondition)}
                  disabled={saving}
                >
                  {IVA_CONDITION_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FormField>
            </div>
            {serverError && (
              <p role="alert" className="rounded-sm border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">
                {serverError}
              </p>
            )}
          </div>
          <div className="border-t border-border bg-surface-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-fg-muted">
              Podés cargar varios {config.plural} antes de continuar.
            </span>
            <Btn variant="teal" size="sm" onClick={handleSave} disabled={saving}>
              <IcoPlus size={12} color="#0C647A" />
              {saving ? 'Guardando…' : `Guardar ${label}`}
            </Btn>
          </div>
        </div>
      </div>
    )
  } else if (mode === 'csv') {
    panelContent = (
      <div>
        <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>
          <IcoArrow dir="left" size={12} color="#71717A" />
          Cambiar
        </Btn>
        <div className="mt-3.5 rounded-lg border-2 border-dashed border-border-strong bg-surface shadow-sm p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <IcoUpload size={24} color="#A1A1AA" />
          </div>
          <p className="text-[13px] font-medium text-fg-muted mb-1">
            Importar {config.plural} desde CSV
          </p>
          <p className="text-[11px] text-fg-subtle mb-4">Columnas: razón social, CUIT, email, teléfono</p>
          <Btn variant="secondary" size="sm">Seleccionar archivo</Btn>
        </div>
      </div>
    )
  } else {
    panelContent = (
      <div className="rounded-lg border border-border bg-surface shadow-sm p-6 text-center">
        <p className="text-[13px] text-fg-muted">
          Podés agregar {config.plural} desde <strong>Contactos</strong> en cualquier momento.
        </p>
        <div className="mt-4">
          <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>Elegir otro método</Btn>
        </div>
      </div>
    )
  }

  return (
    <>
      {panelContent}
      <OnboardingContactsTable
        contactType={contactType}
        plural={config.plural}
        refresh={listRefresh}
      />
    </>
  )
}

// ─── STEP 5: SALES ────────────────────────────────────────────────────────────

const FACTURA_DEFAULT_OPTIONS = [
  { value: 'A', label: 'Factura A (Responsable inscripto)' },
  { value: 'B', label: 'Factura B (Consumidor final / Monotributo)' },
  { value: 'C', label: 'Factura C (Monotributo emisor)' },
  { value: 'E', label: 'Factura E (Exportación)' },
]

const MONEDA_OPTIONS = [
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'USD', label: 'USD — Dólar (referencia)' },
]

const IVA_RATE_OPTIONS = [
  { value: '21', label: '21% — Alícuota general' },
  { value: '10.5', label: '10,5% — Alícuota reducida' },
  { value: '27', label: '27% — Alícuota especial' },
  { value: '0', label: 'Exento / No gravado' },
]

const PRECIO_IVA_OPTIONS = [
  { value: 'sin', label: 'Sin IVA (base imponible)' },
  { value: 'con', label: 'Con IVA incluido' },
]

const COND_PAGO_OPTIONS = [
  { value: '0', label: 'Contado' },
  { value: '15', label: '15 días' },
  { value: '30', label: '30 días' },
  { value: '60', label: '60 días' },
  { value: '90', label: '90 días' },
]

function StepSales({
  onNext,
  onBack,
  data,
  setData,
}: {
  onNext: () => void
  onBack: () => void
  data: WizardData
  setData: (fn: (prev: WizardData) => WizardData) => void
}) {
  const set = (key: string, val: string | boolean) =>
    setData(prev => ({ ...prev, sales: { ...(prev.sales ?? {}), [key]: val } }))
  const d = data.sales ?? {
    tipoFactura: 'A',
    moneda: 'ARS',
    condPago: '30',
    iva: '21',
    incluirIVA: false,
  }

  return (
    <StepWrapper onNext={onNext} onBack={onBack} contentClassName="max-w-[980px]">
      <SectionTitle sub="Configurá los valores por defecto para emitir comprobantes y la facturación electrónica AFIP.">
        Ventas y facturación
      </SectionTitle>

      <div className="space-y-5">
        <InfoBanner variant="teal">
          Los datos fiscales del emisor (razón social, CUIT, condición IVA) se cargan en el paso{' '}
          <strong>Datos de empresa</strong>. Podés revisarlos y completarlos después en{' '}
          <strong>Configuración → AFIP</strong>.
        </InfoBanner>

        <AfipConfigSection
          title="Comprobantes"
          description="Valores por defecto al crear facturas y presupuestos."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Tipo de factura por defecto">
              <Select
                id="onb_tipo_factura"
                value={d.tipoFactura ?? 'A'}
                onChange={(value) => set('tipoFactura', value)}
                options={FACTURA_DEFAULT_OPTIONS}
              />
            </FormField>
          </div>
        </AfipConfigSection>

        <AfipPuntosDeVentaSection />

        <AfipCertificadoSection defaultCuitDigits={normalizeCuitDigits(data.company?.cuit)} />

        <AfipConfigSection
          title="Precios e impuestos"
          description="Afectan cómo se muestran y calculan los importes en ventas y catálogo."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Moneda base">
              <Select
                id="onb_moneda"
                value={d.moneda ?? 'ARS'}
                onChange={(value) => set('moneda', value)}
                options={MONEDA_OPTIONS}
              />
            </FormField>
            <FormField label="Alícuota IVA por defecto">
              <Select
                id="onb_iva"
                value={d.iva ?? '21'}
                onChange={(value) => set('iva', value)}
                options={IVA_RATE_OPTIONS}
              />
            </FormField>
            <FormField label="Precios en catálogo">
              <Select
                id="onb_precio_iva"
                value={d.incluirIVA ? 'con' : 'sin'}
                onChange={(value) => set('incluirIVA', value === 'con')}
                options={PRECIO_IVA_OPTIONS}
              />
            </FormField>
          </div>
        </AfipConfigSection>

        <AfipConfigSection
          title="Condiciones de pago"
          description="Plazo por defecto en nuevos comprobantes de venta."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Condición por defecto">
              <Select
                id="onb_cond_pago"
                value={d.condPago ?? '30'}
                onChange={(value) => set('condPago', value)}
                options={COND_PAGO_OPTIONS}
              />
            </FormField>
          </div>
        </AfipConfigSection>
      </div>
    </StepWrapper>
  )
}

// ─── STEP 6: INTEGRATIONS ─────────────────────────────────────────────────────

function StepIntegrations({
  onNext,
  onBack,
  onSkip,
  data,
  setData,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  data: WizardData
  setData: (fn: (prev: WizardData) => WizardData) => void
}) {
  const connected = data.integrations ?? []
  const toggle = (id: string) => {
    const next = connected.includes(id) ? connected.filter(i => i !== id) : [...connected, id]
    setData(prev => ({ ...prev, integrations: next }))
  }

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))]

  return (
    <StepWrapper onNext={onNext} onBack={onBack} canSkip onSkip={onSkip}>
      <SectionTitle sub="Conectá Andiko con los servicios que ya usás. Las integraciones marcadas como Próximamente aún no están disponibles.">
        Integraciones
      </SectionTitle>
      <div className="flex flex-col gap-5">
        {categories.map(cat => (
          <OnboardingFormSection key={cat} title={cat}>
            <div className="flex flex-col gap-2.5">
              {INTEGRATIONS.filter(i => i.category === cat).map(intg => (
                <IntegrationRow
                  key={intg.id}
                  intg={intg}
                  isOn={connected.includes(intg.id)}
                  onToggle={() => toggle(intg.id)}
                />
              ))}
            </div>
          </OnboardingFormSection>
        ))}
      </div>

      <InfoBanner variant="teal" className="mt-6">
        Este paso es opcional. Podés configurar integraciones más adelante desde{' '}
        <strong>Configuración</strong>.
      </InfoBanner>
    </StepWrapper>
  )
}

function IntegrationRow({
  intg,
  isOn,
  onToggle,
}: {
  intg: { id: string; label: string; desc: string; recommended: boolean; available: boolean }
  isOn: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (!intg.available) {
    return (
      <div className="rounded-lg border border-border bg-surface-muted/60 shadow-sm overflow-hidden opacity-90">
        <div className="flex items-center gap-3 p-3.5 sm:p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-surface-hover">
            <IcoLink size={16} color="#71717A" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-fg-muted">{intg.label}</span>
              <Badge color="zinc">Próximamente</Badge>
            </div>
            <p className="text-[12px] leading-snug text-fg-muted">{intg.desc}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border shadow-sm overflow-hidden transition-all ${
        isOn
          ? 'border-teal-300 bg-teal-50/80'
          : 'border-border bg-surface hover:border-teal-200 hover:bg-teal-50/20'
      }`}
    >
      <div className="flex items-center gap-3 p-3.5 sm:p-4">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm ${
            isOn ? 'bg-teal-100' : 'bg-surface-hover'
          }`}
        >
          <IcoLink size={16} color={isOn ? '#0C647A' : '#71717A'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className={`text-[13px] font-medium ${isOn ? 'text-teal-800' : 'text-fg'}`}>{intg.label}</span>
            {intg.recommended && <Badge color="amber">Recomendado</Badge>}
            {isOn && <Badge color="green">Activado</Badge>}
          </div>
          <p className="text-[12px] leading-snug text-fg-muted">{intg.desc}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {isOn && (
            <Btn variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar' : 'Configurar'}
            </Btn>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            onClick={onToggle}
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
              isOn ? 'bg-teal-600' : 'bg-border-strong'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${
                isOn ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
      {isOn && expanded && (
        <div className="border-t border-teal-200 bg-surface/70 px-3.5 pb-4 pt-3 sm:px-4">
          {intg.id === 'email' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Servidor SMTP">
                <input type="text" className={inputCls()} placeholder="smtp.gmail.com" />
              </FormField>
              <FormField label="Puerto">
                <input type="text" className={inputCls()} placeholder="587" />
              </FormField>
              <FormField label="Usuario">
                <input type="email" className={inputCls()} placeholder="correo@empresa.com" />
              </FormField>
              <FormField label="Contraseña">
                <input type="password" className={inputCls()} placeholder="••••••••" />
              </FormField>
            </div>
          )}
          {intg.id === 'woocommerce' && (
            <p className="text-[12px] text-fg-muted">
              Después del asistente, configurá tus tiendas en{' '}
              <Link href="/integraciones/woocommerce" className="font-medium text-teal-700 hover:underline">
                Integraciones → WooCommerce
              </Link>
              {' '}o desde{' '}
              <Link href="/configuracion?section=integraciones" className="font-medium text-teal-700 hover:underline">
                Configuración → Integraciones
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── STEP 7: USERS ────────────────────────────────────────────────────────────

function StepUsers({
  onNext,
  onBack,
  onSkip,
  data,
  setData,
  userEmail,
  userName,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  data: WizardData
  setData: (fn: (prev: WizardData) => WizardData) => void
  userEmail: string
  userName: string
}) {
  const [users, setUsers] = useState<UserRow[]>(
    data.users ?? [{ email: '', firstName: '', lastName: '', rol: 'vendedor' }],
  )

  const addUser = () => setUsers(prev => [...prev, { email: '', firstName: '', lastName: '', rol: 'vendedor' }])
  const setUser = (idx: number, key: keyof UserRow, val: string) =>
    setUsers(prev => prev.map((u, i) => (i === idx ? { ...u, [key]: val } : u)))
  const removeUser = (idx: number) => setUsers(prev => prev.filter((_, i) => i !== idx))

  const handleNext = () => {
    setData(prev => ({ ...prev, users }))
    onNext()
  }

  return (
    <StepWrapper onNext={handleNext} onBack={onBack} canSkip onSkip={onSkip}>
      <SectionTitle sub="Invitá a los miembros de tu equipo. Recibirán un email para crear su contraseña. Podés agregar más usuarios después desde Organización.">
        Usuarios y roles
      </SectionTitle>

      <div className="flex flex-col gap-5">
        <OnboardingFormSection title="Roles disponibles">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map(r => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-surface-muted/40 p-3 transition-colors hover:border-teal-200 hover:bg-teal-50/30"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium text-fg">{r.label}</span>
                  {'ownerOnly' in r && r.ownerOnly ? <Badge color="teal">Tu cuenta</Badge> : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-fg-muted">{r.desc}</p>
              </div>
            ))}
          </div>
        </OnboardingFormSection>

        <OnboardingFormSection title="Invitar usuarios">
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
                <col className="w-10" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-teal-50/60">
                  {['Email', 'Nombre', 'Apellido', 'Rol', ''].map((header) => (
                    <th
                      key={header || '_actions'}
                      className="px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-teal-800/80 whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border bg-teal-50/40">
                  <td className="px-2.5 py-2.5 text-xs font-mono text-fg-muted">{userEmail}</td>
                  <td className="px-2.5 py-2.5 text-xs text-fg">{userName || 'Vos'}</td>
                  <td className="px-2.5 py-2.5 text-xs text-fg-subtle">—</td>
                  <td className="px-2.5 py-2.5">
                    <Badge color="teal">{getBuiltinRoleLabel('admin')}</Badge>
                  </td>
                  <td className="px-2 py-2.5" />
                </tr>
                {users.map((u, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border last:border-b-0 transition-colors hover:bg-teal-50/30 even:bg-surface-muted/30"
                  >
                    <td className="p-2">
                      <input
                        type="email"
                        value={u.email}
                        onChange={e => setUser(idx, 'email', e.target.value)}
                        placeholder="nombre@empresa.com"
                        className={`w-full ${inputCls()}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={u.firstName}
                        onChange={e => setUser(idx, 'firstName', e.target.value)}
                        placeholder="Nombre"
                        className={`w-full ${inputCls()}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={u.lastName}
                        onChange={e => setUser(idx, 'lastName', e.target.value)}
                        placeholder="Apellido"
                        className={`w-full ${inputCls()}`}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={u.rol}
                        onChange={e => setUser(idx, 'rol', e.target.value)}
                        className={`w-full ${selectCls()}`}
                      >
                        {INVITABLE_ROLES.map(r => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeUser(idx)}
                        className="flex h-8 w-8 items-center justify-center rounded-sm border border-transparent text-fg-subtle transition-colors hover:border-danger/20 hover:bg-danger/5 hover:text-danger"
                        aria-label="Quitar usuario"
                      >
                        <IcoX size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <span className="text-[11px] text-fg-muted">
              Los invitados recibirán un email para activar su cuenta.
            </span>
            <Btn variant="teal" size="sm" onClick={addUser}>
              <IcoPlus size={12} color="#0C647A" />
              Agregar usuario
            </Btn>
          </div>
        </OnboardingFormSection>
      </div>

      <InfoBanner variant="teal" className="mt-6">
        Este paso es opcional. Podés invitar más usuarios después desde{' '}
        <strong>Organización</strong>.
      </InfoBanner>
    </StepWrapper>
  )
}

// ─── STEP 8: DONE ────────────────────────────────────────────────────────────

function StepDone({
  data,
  onGoToDashboard,
  onBack,
  isRevisit = false,
}: {
  data: WizardData
  onGoToDashboard: () => void
  onBack: () => void
  isRevisit?: boolean
}) {
  const modules = (data.modules ?? BASE_TIER_MODULES) as OrgModuleKey[]
  const moduleLabels = modules
    .map(key => ORG_MODULE_DEFS.find(m => m.key === key)?.label ?? key)
    .join(', ')
  const hasIntegrations = (data.integrations?.length ?? 0) > 0
  const productsDesc = data.productsMode === 'manual'
    ? `${(data.products ?? []).filter(p => p.nombre).length} cargados`
    : data.productsMode === 'csv'
    ? 'Importados por CSV'
    : 'Sin cargar aún'

  const quickActions = [
    { label: 'Crear primera factura',    href: '/ventas/facturas/nueva' },
    { label: 'Ver inventario',           href: '/inventario'            },
    { label: 'Agregar cliente',          href: '/contactos'             },
    { label: 'Configurar AFIP',          href: '/configuracion'         },
  ].filter((_, i) => i < 4)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1 px-10 py-10 flex flex-col items-center max-w-[640px] w-full mx-auto">
        {/* Success mark */}
        <div className="w-14 h-14 bg-success-bg border border-success rounded-full flex items-center justify-center mb-5">
          <IcoCheck size={26} color="#16A34A" />
        </div>

        <h1 className="text-[22px] font-semibold text-fg tracking-tight mb-2 text-center">
          Configuración completada
        </h1>
        <p className="text-sm text-fg-muted leading-relaxed text-center max-w-[420px] mb-8">
          Tu empresa está lista para operar en Andiko. Podés ajustar cualquier configuración desde el panel de administración.
        </p>

        {/* Summary */}
        <div className="w-full rounded-lg border border-border bg-surface shadow-sm overflow-hidden mb-6">
          <div className="border-b border-border bg-teal-50/60 px-4 py-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-teal-800/80">
              Resumen de configuración
            </h2>
          </div>
          <dl className="divide-y divide-border">
            {[
              { label: 'Empresa', value: data.company?.razonSocial ?? 'Sin configurar' },
              { label: 'CUIT', value: data.company?.cuit ?? '—', mono: true },
              { label: 'Módulos activos', value: moduleLabels },
              { label: 'Productos', value: productsDesc },
              {
                label: 'Integraciones',
                value: hasIntegrations ? (data.integrations ?? []).join(', ') : 'Ninguna',
              },
              {
                label: 'Usuarios invitados',
                value:
                  (data.users ?? []).filter(u => u.email).length > 0
                    ? `${(data.users ?? []).filter(u => u.email).length} invitados`
                    : 'Solo vos',
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-0.5 px-4 py-3 transition-colors even:bg-surface-muted/30 hover:bg-teal-50/30 sm:flex-row sm:items-start sm:gap-4"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted sm:w-36 sm:flex-shrink-0 sm:pt-0.5">
                  {row.label}
                </dt>
                <dd
                  className={`text-[13px] font-medium text-fg sm:flex-1 min-w-0 break-words ${row.mono ? 'font-mono text-fg-muted' : ''}`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick actions */}
        <div className="w-full mb-6">
          <div className="text-xs font-semibold text-fg-muted mb-2.5">Primeros pasos sugeridos</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickActions.map((a, i) => (
              <a
                key={i}
                href={a.href}
                className="flex items-center gap-2.5 p-3 border border-border rounded bg-surface hover:border-teal-400 hover:bg-teal-50 transition-all"
              >
                <div className="w-7 h-7 bg-surface-hover rounded-sm flex items-center justify-center flex-shrink-0">
                  <IcoArrow size={13} color="#71717A" />
                </div>
                <span className="text-[13px] text-fg flex-1">{a.label}</span>
                <IcoArrow size={12} color="#A1A1AA" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Btn variant="secondary" size="lg" onClick={onBack} full>
            Volver a editar
          </Btn>
          <Btn variant="primary" size="lg" onClick={onGoToDashboard} full>
            {isRevisit ? 'Guardar y volver al panel' : 'Ir al panel principal'}
            <IcoArrow dir="right" size={14} color="#fff" />
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────

function WizardTopBar({
  currentStep,
  totalSteps,
  stepLabel,
  onSaveAndExit,
}: {
  currentStep: number
  totalSteps: number
  stepLabel: string
  onSaveAndExit: () => void
}) {
  return (
    <div className="h-12 bg-surface border-b border-border flex items-center px-4 md:px-5 gap-3 flex-shrink-0">
      <div className="flex-1 min-w-0 md:hidden">
        <span className="text-xs font-medium text-fg truncate block">{stepLabel}</span>
      </div>
      <div className="hidden md:block flex-1" />
      <span className="text-xs text-fg-subtle whitespace-nowrap">
        Paso{' '}
        <span className="text-fg-muted font-medium">{Math.min(currentStep + 1, totalSteps)}</span>
        {' '}de{' '}
        <span className="font-medium text-fg-muted">{totalSteps}</span>
      </span>
      <Btn variant="ghost" size="sm" onClick={onSaveAndExit}>
        Guardar progreso y salir
      </Btn>
    </div>
  )
}

// ─── MAIN WIZARD ─────────────────────────────────────────────────────────────

const DEFAULT_DATA: WizardData = {
  company: {},
  modules: [...BASE_TIER_MODULES],
  products: [{ nombre: '', sku: '', precio: '', categoria: '', stock: '' }],
  sales: {
    tipoFactura: 'A',
    moneda: 'ARS',
    condPago: '30',
    iva: '21',
    incluirIVA: false,
    puntoVenta: '',
    afipEnvironment: 'homologacion',
    afipCert: '',
    afipKey: '',
  },
  integrations: [],
  users: [],
}

function normalizeCuitDigits(cuit: string | undefined): string {
  return (cuit ?? '').replace(/\D/g, '')
}

async function uploadAfipCredentialsFromOnboarding(data: WizardData): Promise<void> {
  const sales = data.sales
  const cert = sales?.afipCert?.trim()
  const key = sales?.afipKey?.trim()
  const cuit = normalizeCuitDigits(data.company?.cuit)
  if (!cert || !key || cuit.length !== 11) return

  await fetchJson('/api/v1/afip/credentials', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: sales?.afipEnvironment ?? 'homologacion',
      cuit,
      cert,
      key,
    }),
  })
}

export function OnboardingWizardClient({
  orgId,
  userEmail,
  userName,
  initialData,
  isRevisit = false,
}: Props) {
  const router = useRouter()
  const storageKey = `andiko-onboarding-${orgId}`

  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') {
      return typeof initialData?.wizardStep === 'number' ? initialData.wizardStep : 0
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      if (typeof saved.step === 'number') return saved.step
    } catch {
      /* ignore */
    }
    return typeof initialData?.wizardStep === 'number' ? initialData.wizardStep : 0
  })

  const [data, setData] = useState<WizardData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
        if (saved.data) return saved.data as WizardData
      } catch {
        /* ignore */
      }
    }
    if (initialData) {
      const { wizardStep: _wizardStep, completedStepIds: _completedStepIds, ...rest } = initialData
      void _wizardStep
      void _completedStepIds
      return { ...DEFAULT_DATA, ...rest }
    }
    return DEFAULT_DATA
  })

  const [completed, setCompleted] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return Array.isArray(initialData?.completedStepIds) ? initialData.completedStepIds : []
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      if (Array.isArray(saved.completed)) return saved.completed as string[]
    } catch {
      /* ignore */
    }
    return Array.isArray(initialData?.completedStepIds) ? initialData.completedStepIds : []
  })

  const [saving, setSaving] = useState(false)

  // Persist locally on every change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ step, data, completed }))
    } catch {
      /* ignore */
    }
  }, [step, data, completed, storageKey])

  const markComplete = useCallback(
    (stepId: string) => {
      setCompleted(prev => (prev.includes(stepId) ? prev : [...prev, stepId]))
    },
    [],
  )

  const saveProgress = useCallback(
    async (d: WizardData, currentStep = step, completedSteps = completed) => {
      try {
        await fetch('/api/v1/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: { ...d, wizardStep: currentStep, completedStepIds: completedSteps },
            complete: false,
          }),
        })
      } catch {
        /* non-blocking */
      }
    },
    [step, completed],
  )

  const goNext = () => {
    const cur = STEPS[step]
    if (cur) markComplete(cur.id)
    saveProgress(data)
    if (step < STEPS.length - 1) setStep((s: number) => s + 1)
  }

  const goBack = () => {
    if (step > 0) setStep((s: number) => s - 1)
  }

  const goSkip = () => {
    const cur = STEPS[step]
    if (cur) markComplete(cur.id)
    if (step < STEPS.length - 1) setStep((s: number) => s + 1)
  }

  const jumpTo = (idx: number) => setStep(idx)

  const handleComplete = async () => {
    setSaving(true)
    try {
      await uploadAfipCredentialsFromOnboarding(data)
      await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, complete: true }),
      })
      localStorage.removeItem(storageKey)
      router.push(await fetchLandingPath())
    } catch {
      router.push(await fetchLandingPath())
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndExit = async () => {
    await saveProgress(data)
    router.push(await fetchLandingPath())
  }

  const currentId = STEPS[step]?.id
  const displaySteps = STEPS.filter(s => s.id !== 'done')
  const currentStepLabel = STEPS[step]?.label ?? ''

  const renderStep = () => {
    const props = { data, setData, onNext: goNext, onBack: goBack, onSkip: goSkip }
    switch (currentId) {
      case 'welcome':
        return <StepWelcome onNext={goNext} />
      case 'company':
        return <StepCompany {...props} />
      case 'modules':
        return <StepModules {...props} />
      case 'products':
        return <StepProducts {...props} />
      case 'contacts':
        return <StepContacts onNext={goNext} onBack={goBack} onSkip={goSkip} />
      case 'sales':
        return <StepSales {...props} />
      case 'integrations':
        return <StepIntegrations {...props} />
      case 'users':
        return (
          <StepUsers
            {...props}
            userEmail={userEmail}
            userName={userName}
          />
        )
      case 'done':
        return (
          <StepDone
            data={data}
            onGoToDashboard={handleComplete}
            onBack={goBack}
            isRevisit={isRevisit}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-muted">
      {isRevisit && (
        <div className="flex-shrink-0 border-b border-teal-200 bg-teal-50 px-4 py-2 text-xs text-teal-800">
          Estás revisando la configuración inicial. Los cambios se guardan al completar el asistente.
        </div>
      )}
      <WizardTopBar
        currentStep={step}
        totalSteps={displaySteps.length}
        stepLabel={currentStepLabel}
        onSaveAndExit={handleSaveAndExit}
      />
      <div className="flex-1 flex overflow-hidden">
        <ProgressRail
          currentStep={step}
          completedSteps={completed}
          onJump={jumpTo}
          allowAllSteps={isRevisit}
        />
        <div className="flex-1 flex overflow-hidden bg-surface-muted">
          {renderStep()}
        </div>
      </div>
      {saving && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-surface rounded px-5 py-3 text-sm text-fg-muted shadow-lg">
            Guardando configuración...
          </div>
        </div>
      )}
    </div>
  )
}
