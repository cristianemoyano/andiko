'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { OnboardingData } from '@/modules/auth/organization.model'

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

interface UserRow {
  email: string
  nombre: string
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

const MODULES_LIST = [
  { id: 'ventas',     label: 'Ventas',      desc: 'Presupuestos, órdenes, facturas y cobros',           recommended: true  },
  { id: 'inventario', label: 'Inventario',  desc: 'Productos, stock, depósitos y remitos',              recommended: true  },
  { id: 'compras',    label: 'Compras',     desc: 'Órdenes de compra, recepción y proveedores',         recommended: false },
  { id: 'crm',        label: 'CRM',         desc: 'Clientes, contactos y seguimiento comercial',        recommended: false },
  { id: 'finanzas',   label: 'Finanzas',    desc: 'Cuentas, movimientos, libro diario y AFIP',          recommended: false },
  { id: 'reportes',   label: 'Reportes',    desc: 'Tableros, indicadores y exportación de datos',       recommended: false },
]

const INTEGRATIONS = [
  { id: 'afip',          label: 'AFIP — Factura electrónica', desc: 'Emisión de comprobantes a través del servicio web AFIP (WSFEv1).', category: 'Fiscal',         recommended: true  },
  { id: 'mercadolibre',  label: 'Mercado Libre',              desc: 'Sincronización de catálogo, stock y pedidos.',                     category: 'E-commerce',     recommended: false },
  { id: 'tiendanube',    label: 'Tienda Nube',                desc: 'Integración bidireccional de inventario, órdenes y clientes.',     category: 'E-commerce',     recommended: false },
  { id: 'woocommerce',   label: 'WooCommerce',                desc: 'Conectá tu tienda WordPress a través de API REST.',                category: 'E-commerce',     recommended: false },
  { id: 'mercadopago',   label: 'Mercado Pago',               desc: 'Conciliación automática de cobros y link de pago en facturas.',    category: 'Pagos',          recommended: false },
  { id: 'email',         label: 'Servidor de email (SMTP)',   desc: 'Enviá facturas y presupuestos directamente por email.',            category: 'Comunicación',   recommended: false },
]

const ROLES = [
  { id: 'admin',       label: 'Administrador', desc: 'Acceso completo a todos los módulos y configuración' },
  { id: 'vendedor',    label: 'Vendedor',       desc: 'Puede crear presupuestos, facturas y ver clientes'   },
  { id: 'comprador',   label: 'Comprador',      desc: 'Gestión de compras, proveedores y recepción'         },
  { id: 'contador',    label: 'Contador',       desc: 'Acceso a contabilidad, reportes e impuestos'         },
  { id: 'deposito',    label: 'Depósito',       desc: 'Solo inventario: movimientos de stock y remitos'     },
  { id: 'solo_lectura',label: 'Solo lectura',   desc: 'Puede ver pero no modificar ningún registro'         },
]

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

// ─── ANDIKO LOGO ─────────────────────────────────────────────────────────────

function AndikoLogo({ size = 24 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded flex-shrink-0"
      style={{ width: size, height: size, background: '#0C647A' }}
    >
      <svg viewBox="0 0 12 12" style={{ width: size * 0.5, height: size * 0.5, fill: '#fff' }}>
        <rect x="0" y="1" width="3" height="10" />
        <rect x="0" y="1" width="12" height="3" />
        <rect x="9" y="1" width="3" height="10" />
        <rect x="2" y="5" width="8" height="2.5" />
      </svg>
    </div>
  )
}

// ─── SHARED PRIMITIVES ────────────────────────────────────────────────────────

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <div className="text-base font-semibold text-zinc-900 tracking-tight">{children}</div>
      {sub && <div className="text-sm text-zinc-500 mt-1 leading-relaxed">{sub}</div>}
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-zinc-600 mb-1">
      {children}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-zinc-400 mt-1">{children}</p>
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-red-600 mt-1">{children}</p>
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
  `w-full h-[34px] px-2.5 text-[13px] text-zinc-900 bg-white border rounded-sm outline-none transition-colors
   ${error ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'border-zinc-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100'}`

const selectCls = (error?: string) =>
  `w-full h-[34px] px-2.5 text-[13px] text-zinc-900 bg-white border rounded-sm outline-none appearance-none transition-colors
   ${error ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'border-zinc-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100'}`

function Divider() {
  return <div className="h-px bg-zinc-200 my-5" />
}

function InfoBanner({ children, variant = 'teal' }: { children: React.ReactNode; variant?: 'teal' | 'amber' }) {
  const cls =
    variant === 'teal'
      ? 'bg-teal-50 border-teal-200 text-teal-800'
      : 'bg-amber-50 border-amber-300 text-amber-900'
  return (
    <div className={`flex gap-2.5 items-start p-3 border rounded-sm text-xs leading-relaxed ${cls}`}>
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
    zinc:  'bg-zinc-100 text-zinc-600 border-zinc-300',
    teal:  'bg-teal-50 text-teal-700 border-teal-200',
    amber: 'bg-amber-100 text-amber-900 border-amber-300',
    green: 'bg-green-100 text-green-900 border-green-300',
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
    secondary: 'bg-white hover:bg-zinc-50 text-zinc-900 border-zinc-300',
    ghost:     'bg-transparent hover:bg-zinc-100 text-zinc-600 border-transparent',
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
}: {
  currentStep: number
  completedSteps: string[]
  onJump: (idx: number) => void
}) {
  const displaySteps = STEPS.filter(s => s.id !== 'done')
  const pct = Math.round((completedSteps.length / displaySteps.length) * 100)

  return (
    <div className="w-[220px] flex-shrink-0 bg-white border-r border-zinc-200 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-zinc-200 flex items-center gap-2.5">
        <AndikoLogo size={24} />
        <span className="text-[15px] font-semibold text-zinc-900 tracking-tight">andiko</span>
      </div>

      {/* Progress summary */}
      <div className="px-5 py-3.5 border-b border-zinc-200">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-1">
          Configuración inicial
        </div>
        <div className="h-1 bg-zinc-200 rounded-sm overflow-hidden">
          <div
            className="h-full bg-teal-600 rounded-sm transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] text-zinc-400 mt-1.5">
          {completedSteps.length} de {displaySteps.length} pasos completados
        </div>
      </div>

      {/* Steps */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {displaySteps.map((step, idx) => {
          const stepIdx = STEPS.findIndex(s => s.id === step.id)
          const isActive = STEPS[currentStep]?.id === step.id
          const isDone = completedSteps.includes(step.id)
          const isAccessible = isDone || stepIdx <= currentStep + 1
          return (
            <button
              key={step.id}
              onClick={() => isAccessible && onJump(stepIdx)}
              disabled={!isAccessible}
              className={`w-full flex items-center gap-2.5 px-5 py-[7px] text-left transition-colors
                ${isActive ? 'bg-teal-50' : isAccessible ? 'hover:bg-zinc-100' : ''}
                ${isAccessible ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* Indicator */}
              <div
                className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border transition-all
                  ${isDone || isActive ? 'bg-teal-600 border-teal-600' : 'bg-zinc-200 border-zinc-300'}`}
              >
                {isDone ? (
                  <IcoCheck size={10} color="#fff" />
                ) : (
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                    {idx + 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs truncate ${isActive ? 'font-medium text-teal-700' : isDone ? 'text-zinc-700' : 'text-zinc-500'}`}
                >
                  {step.label}
                </div>
                {step.optional && (
                  <div className="text-[10px] text-zinc-400">Opcional</div>
                )}
              </div>
              {step.time && !isDone && (
                <span className="text-[10px] text-zinc-400 flex-shrink-0">{step.time}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-zinc-200">
        <p className="text-[11px] text-zinc-400">
          Tiempo estimado: <span className="font-medium text-zinc-600">~15 min</span>
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
}) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1 px-10 py-8 max-w-[680px] w-full mx-auto">
        {children}
      </div>
      {!isLast && (
        <div className="border-t border-zinc-200 px-10 py-3.5 flex items-center gap-2.5 bg-white flex-shrink-0">
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
          <AndikoLogo size={52} />
        </div>
        <h1 className="text-[22px] font-semibold text-zinc-900 tracking-tight mb-2.5">
          Bienvenido a Andiko
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-[460px] mx-auto mb-8">
          En los próximos minutos vas a configurar tu empresa y dejar el sistema listo para operar. Podés completar los pasos ahora o volver más tarde.
        </p>

        <div className="bg-zinc-50 border border-zinc-200 rounded p-5 text-left max-w-[440px] mx-auto mb-8">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3.5">
            En esta configuración
          </div>
          <div className="flex flex-col gap-3">
            {[
              'Datos de tu empresa y condición fiscal',
              'Módulos que vas a usar (podés cambiarlos después)',
              'Productos, clientes y proveedores',
              'Configuración de ventas y facturación AFIP',
              'Integraciones y usuarios del sistema',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <IcoCheck size={9} color="#0C647A" />
                </div>
                <span className="text-[13px] text-zinc-700">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 justify-center">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5L8 8" />
          </svg>
          <span className="text-xs text-zinc-400">Tiempo estimado: 15 minutos</span>
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

      <div className="flex flex-col gap-4">
        <FormField label="Razón social" required error={errors.razonSocial}>
          <input
            type="text"
            className={inputCls(errors.razonSocial)}
            value={d.razonSocial ?? ''}
            onChange={e => set('razonSocial', e.target.value)}
            placeholder="Ej: Distribuidora Sur S.A."
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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

        <Divider />
        <div className="text-[13px] font-medium text-zinc-700 -mb-2">Domicilio fiscal</div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-3 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
      </div>
    </StepWrapper>
  )
}

// ─── STEP 2: MODULES ─────────────────────────────────────────────────────────

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
  const selected = data.modules ?? ['ventas', 'inventario']

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter(m => m !== id) : [...selected, id]
    setData(prev => ({ ...prev, modules: next }))
  }

  return (
    <StepWrapper onNext={onNext} onBack={onBack} canNext={selected.length > 0}>
      <SectionTitle sub="Activá los módulos que tu empresa va a usar. Podés habilitarlos o deshabilitarlos en cualquier momento desde Configuración.">
        Módulos del sistema
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2.5">
        {MODULES_LIST.map(mod => {
          const isOn = selected.includes(mod.id)
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggle(mod.id)}
              className={`flex gap-3 items-start p-3.5 border-[1.5px] rounded text-left transition-all
                ${isOn ? 'border-teal-400 bg-teal-50' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'}`}
            >
              <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-teal-100' : 'bg-zinc-100'}`}>
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={isOn ? '#0C647A' : '#71717A'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="12" height="12" rx="1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[13px] font-medium ${isOn ? 'text-teal-700' : 'text-zinc-800'}`}>{mod.label}</span>
                  {mod.recommended && <Badge color="teal">Recomendado</Badge>}
                </div>
                <p className="text-[11px] text-zinc-500 leading-snug">{mod.desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${isOn ? 'bg-teal-600 border-teal-600' : 'bg-white border-zinc-300'}`}>
                {isOn && <IcoCheck size={9} color="#fff" />}
              </div>
            </button>
          )
        })}
      </div>

      {selected.length === 0 && (
        <p className="mt-3 text-xs text-red-600">Seleccioná al menos un módulo para continuar.</p>
      )}

      <InfoBanner variant="teal" >
        Los módulos seleccionados determinan qué opciones aparecen en el menú principal. Comenzamos con <strong>Ventas e Inventario</strong> activados por defecto — son los más usados.
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
    <StepWrapper onNext={handleNext} onBack={onBack} canSkip onSkip={handleSkip} canNext={mode !== null}>
      <SectionTitle sub="Cargá tus productos para poder emitir facturas y llevar el stock desde el primer día.">
        Configuración de productos
      </SectionTitle>

      {!mode && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'manual', label: 'Carga manual',  desc: 'Ingresá productos uno por uno' },
            { id: 'csv',    label: 'Importar CSV',   desc: 'Subí un archivo Excel o CSV'   },
            { id: 'later',  label: 'Más tarde',      desc: 'Comenzar sin productos'        },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setMode(opt.id); setData(prev => ({ ...prev, productsMode: opt.id as 'manual' | 'csv' | 'later' })) }}
              className="flex flex-col items-center p-5 border-[1.5px] border-zinc-200 rounded bg-white hover:border-teal-400 hover:bg-teal-50 transition-all text-center"
            >
              <div className="w-9 h-9 bg-zinc-100 rounded-sm flex items-center justify-center mb-2.5">
                <IcoPlus size={18} color="#71717A" />
              </div>
              <span className="text-[13px] font-medium text-zinc-800 mb-1">{opt.label}</span>
              <span className="text-[11px] text-zinc-400 leading-snug">{opt.desc}</span>
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
          <div className="mt-3.5 border border-zinc-200 rounded overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  {['Nombre del producto', 'SKU / Código', 'Precio (ARS)', 'Categoría', 'Stock inicial'].map(h => (
                    <th key={h} className="text-[11px] font-semibold text-zinc-600 p-2 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="p-1">
                      <input type="text" value={p.nombre} onChange={e => setCell(i, 'nombre', e.target.value)} placeholder="Ej: Notebook HP 15" className="w-full border-0 outline-none text-[12px] px-1.5 py-1 bg-transparent" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={p.sku} onChange={e => setCell(i, 'sku', e.target.value)} placeholder="NB-HP-15" className="w-full border-0 outline-none text-[12px] px-1.5 py-1 bg-transparent font-mono" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={p.precio} onChange={e => setCell(i, 'precio', e.target.value)} placeholder="0,00" className="w-full border-0 outline-none text-[12px] px-1.5 py-1 bg-transparent font-mono text-right" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={p.categoria} onChange={e => setCell(i, 'categoria', e.target.value)} placeholder="Electrónica" className="w-full border-0 outline-none text-[12px] px-1.5 py-1 bg-transparent" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={p.stock} onChange={e => setCell(i, 'stock', e.target.value)} placeholder="0" className="w-full border-0 outline-none text-[12px] px-1.5 py-1 bg-transparent font-mono text-right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2.5">
            <Btn variant="teal" size="sm" onClick={addRow}>
              <IcoPlus size={12} color="#0C647A" />
              Agregar producto
            </Btn>
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
              ${dragOver ? 'border-teal-400 bg-teal-50' : 'border-zinc-300 bg-zinc-50'}`}
          >
            <IcoUpload size={28} color={dragOver ? '#0C647A' : '#A1A1AA'} />
            <p className="text-sm font-medium text-zinc-700 mt-3 mb-1">
              Arrastrá tu archivo CSV o Excel aquí
            </p>
            <p className="text-xs text-zinc-400 mb-4">Formatos aceptados: .csv, .xlsx — hasta 10.000 filas</p>
            <Btn variant="secondary" size="sm">
              <IcoUpload size={12} color="#3F3F46" />
              Seleccionar archivo
            </Btn>
          </div>
          <div className="mt-3 p-2.5 bg-zinc-50 border border-zinc-200 rounded-sm text-xs text-zinc-500">
            Tu archivo debe tener columnas:{' '}
            <code className="font-mono text-zinc-700">nombre, sku, precio, categoria, stock</code>
          </div>
        </div>
      )}

      {mode === 'later' && (
        <div className="p-6 bg-zinc-50 border border-zinc-200 rounded text-center">
          <p className="text-sm font-medium text-zinc-700 mb-1">Sin productos por ahora</p>
          <p className="text-xs text-zinc-400">Podés cargar productos desde Inventario → Productos en cualquier momento.</p>
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
    <StepWrapper onNext={onNext} onBack={onBack} canSkip onSkip={onSkip}>
      <SectionTitle sub="Importá tus clientes y proveedores existentes. Este paso es opcional — podés agregarlos después desde Contactos.">
        Clientes y proveedores
      </SectionTitle>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-5">
        {(['clientes', 'proveedores'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] capitalize transition-colors border-b-2 -mb-px
              ${tab === t ? 'border-teal-600 text-teal-700 font-medium' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'clientes' && (
        <ContactPanel mode={clientMode} setMode={setClientMode} type="clientes" />
      )}
      {tab === 'proveedores' && (
        <ContactPanel mode={provMode} setMode={setProvMode} type="proveedores" />
      )}
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
  type: 'clientes' | 'proveedores'
}) {
  const label = type === 'clientes' ? 'cliente' : 'proveedor'

  if (!mode) {
    return (
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { id: 'manual', label: 'Alta manual',  desc: `Ingresá un ${label} ahora`  },
          { id: 'csv',    label: 'Importar CSV',  desc: 'Subí una lista existente'   },
          { id: 'later',  label: 'Después',       desc: 'Agregar desde Contactos'    },
        ].map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMode(opt.id)}
            className="flex flex-col items-center p-4 border-[1.5px] border-zinc-200 rounded bg-white hover:border-teal-400 hover:bg-teal-50 transition-all text-center"
          >
            <span className="text-xs font-medium text-zinc-800">{opt.label}</span>
            <span className="text-[11px] text-zinc-400 mt-0.5">{opt.desc}</span>
          </button>
        ))}
      </div>
    )
  }

  if (mode === 'manual') {
    return (
      <div>
        <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>
          <IcoArrow dir="left" size={12} color="#71717A" />
          Cambiar
        </Btn>
        <div className="mt-3.5 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Razón social / Nombre">
              <input type="text" className={inputCls()} placeholder="Ej: Supermercados Norte S.A." />
            </FormField>
            <FormField label="CUIT / CUIL" hint="XX-XXXXXXXX-X">
              <input type="text" className={`${inputCls()} font-mono`} placeholder="20-12345678-0" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email">
              <input type="email" className={inputCls()} placeholder="contacto@empresa.com" />
            </FormField>
            <FormField label="Teléfono">
              <input type="tel" className={inputCls()} placeholder="+54 11 1234-5678" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Condición IVA">
              <select className={selectCls()}>
                <option value="">Seleccioná...</option>
                <option>Responsable inscripto</option>
                <option>Monotributo</option>
                <option>Consumidor final</option>
                <option>Exento</option>
              </select>
            </FormField>
            <FormField label="Lista de precios">
              <select className={selectCls()}>
                <option value="">Lista por defecto</option>
                <option>Mayorista</option>
                <option>Minorista</option>
              </select>
            </FormField>
          </div>
          <div>
            <Btn variant="teal" size="sm">
              <IcoPlus size={12} color="#0C647A" />
              Guardar {label}
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'csv') {
    return (
      <div>
        <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>
          <IcoArrow dir="left" size={12} color="#71717A" />
          Cambiar
        </Btn>
        <div className="mt-3.5 border-2 border-dashed border-zinc-300 rounded p-8 text-center bg-zinc-50">
          <IcoUpload size={24} color="#A1A1AA" />
          <p className="text-[13px] font-medium text-zinc-700 mt-2.5 mb-1">
            Importar {type} desde CSV
          </p>
          <p className="text-[11px] text-zinc-400 mb-3">Columnas: razón social, CUIT, email, teléfono</p>
          <Btn variant="secondary" size="sm">Seleccionar archivo</Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-zinc-50 border border-zinc-200 rounded text-center">
      <p className="text-[13px] text-zinc-500">
        Podés agregar {type} desde <strong>Contactos</strong> en cualquier momento.
      </p>
      <div className="mt-3">
        <Btn variant="ghost" size="sm" onClick={() => setMode(null)}>Elegir otro método</Btn>
      </div>
    </div>
  )
}

// ─── STEP 5: SALES ────────────────────────────────────────────────────────────

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
  const d = data.sales ?? { tipoFactura: 'A', moneda: 'ARS', condPago: '30', iva: '21', incluirIVA: false, puntoVenta: '' }

  return (
    <StepWrapper onNext={onNext} onBack={onBack}>
      <SectionTitle sub="Configurá los valores por defecto para emitir comprobantes. Podés ajustar esto por cliente o por operación.">
        Ventas y facturación
      </SectionTitle>

      <div className="flex flex-col gap-4">
        <InfoBanner variant="amber">
          Para emitir facturas electrónicas AFIP necesitás el <strong>certificado digital</strong> y el <strong>punto de venta habilitado</strong>. Podés configurarlo ahora o en el paso de Integraciones.
        </InfoBanner>

        <SalesSection title="Comprobantes">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo de factura por defecto">
              <select className={selectCls()} value={d.tipoFactura ?? 'A'} onChange={e => set('tipoFactura', e.target.value)}>
                <option value="A">Factura A (Responsable inscripto)</option>
                <option value="B">Factura B (Consumidor final / Monotributo)</option>
                <option value="C">Factura C (Monotributo emisor)</option>
                <option value="E">Factura E (Exportación)</option>
              </select>
            </FormField>
            <FormField label="Punto de venta AFIP" hint="Número habilitado en AFIP (ej: 0001)">
              <input
                type="text"
                className={`${inputCls()} font-mono`}
                value={d.puntoVenta ?? ''}
                onChange={e => set('puntoVenta', e.target.value)}
                placeholder="0001"
              />
            </FormField>
          </div>
        </SalesSection>

        <SalesSection title="Precios e impuestos">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Moneda base">
              <select className={selectCls()} value={d.moneda ?? 'ARS'} onChange={e => set('moneda', e.target.value)}>
                <option value="ARS">ARS — Peso argentino</option>
                <option value="USD">USD — Dólar (referencia)</option>
              </select>
            </FormField>
            <FormField label="Alícuota IVA por defecto">
              <select className={selectCls()} value={d.iva ?? '21'} onChange={e => set('iva', e.target.value)}>
                <option value="21">21% — Alícuota general</option>
                <option value="10.5">10,5% — Alícuota reducida</option>
                <option value="27">27% — Alícuota especial</option>
                <option value="0">Exento / No gravado</option>
              </select>
            </FormField>
            <FormField label="Precios en catálogo">
              <select
                className={selectCls()}
                value={d.incluirIVA ? 'con' : 'sin'}
                onChange={e => set('incluirIVA', e.target.value === 'con')}
              >
                <option value="sin">Sin IVA (base imponible)</option>
                <option value="con">Con IVA incluido</option>
              </select>
            </FormField>
          </div>
        </SalesSection>

        <SalesSection title="Condiciones de pago">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Condición por defecto">
              <select className={selectCls()} value={d.condPago ?? '30'} onChange={e => set('condPago', e.target.value)}>
                <option value="0">Contado</option>
                <option value="15">15 días</option>
                <option value="30">30 días</option>
                <option value="60">60 días</option>
                <option value="90">90 días</option>
              </select>
            </FormField>
            <FormField label="Método de cobro preferido">
              <select className={selectCls()}>
                <option>Transferencia bancaria</option>
                <option>Cheque</option>
                <option>Efectivo</option>
                <option>Tarjeta</option>
                <option>Mercado Pago</option>
              </select>
            </FormField>
          </div>
        </SalesSection>
      </div>
    </StepWrapper>
  )
}

function SalesSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 rounded overflow-hidden">
      <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
        <span className="text-xs font-semibold text-zinc-600">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
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
      <SectionTitle sub="Conectá Andiko con los servicios que ya usás. Todas las integraciones son opcionales (excepto AFIP para factura electrónica).">
        Integraciones
      </SectionTitle>
      <div className="flex flex-col gap-5">
        {categories.map(cat => (
          <div key={cat}>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">{cat}</div>
            <div className="flex flex-col gap-2">
              {INTEGRATIONS.filter(i => i.category === cat).map(intg => (
                <IntegrationRow
                  key={intg.id}
                  intg={intg}
                  isOn={connected.includes(intg.id)}
                  onToggle={() => toggle(intg.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </StepWrapper>
  )
}

function IntegrationRow({
  intg,
  isOn,
  onToggle,
}: {
  intg: { id: string; label: string; desc: string; recommended: boolean }
  isOn: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`border rounded overflow-hidden transition-all ${isOn ? 'border-teal-200 bg-teal-50' : 'border-zinc-200 bg-white'}`}>
      <div className="flex items-center gap-3 p-3 pr-3.5">
        <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-teal-100' : 'bg-zinc-100'}`}>
          <IcoLink size={15} color={isOn ? '#0C647A' : '#71717A'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-medium text-zinc-800">{intg.label}</span>
            {intg.recommended && <Badge color="amber">Recomendado</Badge>}
            {isOn && <Badge color="green">Activado</Badge>}
          </div>
          <p className="text-[11px] text-zinc-500 leading-snug">{intg.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isOn && (
            <Btn variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar' : 'Configurar'}
            </Btn>
          )}
          {/* Toggle switch */}
          <button
            type="button"
            onClick={onToggle}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isOn ? 'bg-teal-600' : 'bg-zinc-300'}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isOn ? 'left-[18px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>
      {isOn && expanded && (
        <div className="px-3.5 pb-3.5 border-t border-teal-200">
          <div className="pt-3 flex flex-col gap-2.5">
            {intg.id === 'afip' && (
              <>
                <FormField label="Certificado digital (.pfx)">
                  <Btn variant="secondary" size="sm">
                    <IcoUpload size={12} color="#3F3F46" />
                    Subir certificado
                  </Btn>
                </FormField>
                <FormField label="Clave privada">
                  <input type="password" className={inputCls()} placeholder="Pegá tu clave privada AFIP" />
                </FormField>
              </>
            )}
            {intg.id === 'email' && (
              <div className="grid grid-cols-2 gap-3">
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
            {!['afip', 'email'].includes(intg.id) && (
              <FormField label="Clave API / Token de acceso">
                <input type="text" className={inputCls()} placeholder="Pegá tu API key aquí" />
              </FormField>
            )}
          </div>
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
    data.users ?? [{ email: '', nombre: '', rol: 'vendedor' }],
  )

  const addUser = () => setUsers(prev => [...prev, { email: '', nombre: '', rol: 'vendedor' }])
  const setUser = (idx: number, key: keyof UserRow, val: string) =>
    setUsers(prev => prev.map((u, i) => (i === idx ? { ...u, [key]: val } : u)))
  const removeUser = (idx: number) => setUsers(prev => prev.filter((_, i) => i !== idx))

  const handleNext = () => {
    setData(prev => ({ ...prev, users }))
    onNext()
  }

  return (
    <StepWrapper onNext={handleNext} onBack={onBack} canSkip onSkip={onSkip}>
      <SectionTitle sub="Invitá a los miembros de tu equipo. Recibirán un email para crear su contraseña. Podés agregar más usuarios después desde Configuración → Usuarios.">
        Usuarios y roles
      </SectionTitle>

      {/* Role reference */}
      <div className="mb-5">
        <div className="text-xs font-semibold text-zinc-600 mb-2.5">Roles disponibles</div>
        <div className="grid grid-cols-3 gap-1.5">
          {ROLES.map(r => (
            <div key={r.id} className="p-2 border border-zinc-200 rounded-sm bg-zinc-50">
              <div className="text-[11px] font-medium text-zinc-700">{r.label}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* User table */}
      <div className="border border-zinc-200 rounded overflow-hidden mb-3">
        <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-200">
          <div className="grid gap-2 text-[11px] font-semibold text-zinc-600" style={{ gridTemplateColumns: '1fr 1fr 160px 32px' }}>
            <span>Email</span>
            <span>Nombre</span>
            <span>Rol</span>
            <span />
          </div>
        </div>
        {/* Owner row */}
        <div className="grid gap-2 px-3 py-2 border-b border-zinc-100 items-center bg-teal-50" style={{ gridTemplateColumns: '1fr 1fr 160px 32px' }}>
          <span className="text-xs font-mono text-zinc-600">{userEmail}</span>
          <span className="text-xs text-zinc-600">{userName || 'Vos'}</span>
          <Badge color="teal">Administrador</Badge>
          <span />
        </div>
        {users.map((u, idx) => (
          <div key={idx} className="grid gap-2 px-3 py-1.5 border-b border-zinc-100 items-center" style={{ gridTemplateColumns: '1fr 1fr 160px 32px' }}>
            <input
              type="email"
              value={u.email}
              onChange={e => setUser(idx, 'email', e.target.value)}
              placeholder="nombre@empresa.com"
              className="text-xs h-7 px-2 border border-zinc-200 rounded-sm outline-none focus:border-teal-500"
            />
            <input
              type="text"
              value={u.nombre}
              onChange={e => setUser(idx, 'nombre', e.target.value)}
              placeholder="Nombre y apellido"
              className="text-xs h-7 px-2 border border-zinc-200 rounded-sm outline-none focus:border-teal-500"
            />
            <select
              value={u.rol}
              onChange={e => setUser(idx, 'rol', e.target.value)}
              className="text-xs h-7 px-2 border border-zinc-200 rounded-sm outline-none focus:border-teal-500 bg-white"
            >
              {ROLES.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeUser(idx)}
              className="flex items-center justify-center w-8 h-7 text-zinc-400 hover:text-red-600 transition-colors"
            >
              <IcoX size={12} />
            </button>
          </div>
        ))}
      </div>
      <Btn variant="teal" size="sm" onClick={addUser}>
        <IcoPlus size={12} color="#0C647A" />
        Agregar usuario
      </Btn>
    </StepWrapper>
  )
}

// ─── STEP 8: DONE ────────────────────────────────────────────────────────────

function StepDone({ data, onGoToDashboard }: { data: WizardData; onGoToDashboard: () => void }) {
  const modules = data.modules ?? ['ventas', 'inventario']
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
        <div className="w-14 h-14 bg-green-100 border border-green-300 rounded-full flex items-center justify-center mb-5">
          <IcoCheck size={26} color="#16A34A" />
        </div>

        <h1 className="text-[22px] font-semibold text-zinc-900 tracking-tight mb-2 text-center">
          Configuración completada
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed text-center max-w-[420px] mb-8">
          Tu empresa está lista para operar en Andiko. Podés ajustar cualquier configuración desde el panel de administración.
        </p>

        {/* Summary */}
        <div className="w-full border border-zinc-200 rounded overflow-hidden mb-6">
          <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
            <span className="text-xs font-semibold text-zinc-600">Resumen de configuración</span>
          </div>
          {[
            { label: 'Empresa',           value: data.company?.razonSocial ?? 'Sin configurar' },
            { label: 'CUIT',              value: data.company?.cuit ?? '—',                      mono: true },
            { label: 'Módulos activos',   value: modules.join(', ')                              },
            { label: 'Productos',         value: productsDesc                                    },
            { label: 'Integraciones',     value: hasIntegrations ? (data.integrations ?? []).join(', ') : 'Ninguna' },
            {
              label: 'Usuarios invitados',
              value: (data.users ?? []).filter(u => u.email).length > 0
                ? `${(data.users ?? []).filter(u => u.email).length} invitados`
                : 'Solo vos',
            },
          ].map((row, i, arr) => (
            <div
              key={i}
              className={`flex gap-4 px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-zinc-100' : ''}`}
            >
              <span className="text-xs text-zinc-500 w-36 flex-shrink-0">{row.label}</span>
              <span className={`text-xs font-medium text-zinc-800 ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="w-full mb-6">
          <div className="text-xs font-semibold text-zinc-600 mb-2.5">Primeros pasos sugeridos</div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a, i) => (
              <a
                key={i}
                href={a.href}
                className="flex items-center gap-2.5 p-3 border border-zinc-200 rounded bg-white hover:border-teal-400 hover:bg-teal-50 transition-all"
              >
                <div className="w-7 h-7 bg-zinc-100 rounded-sm flex items-center justify-center flex-shrink-0">
                  <IcoArrow size={13} color="#71717A" />
                </div>
                <span className="text-[13px] text-zinc-800 flex-1">{a.label}</span>
                <IcoArrow size={12} color="#A1A1AA" />
              </a>
            ))}
          </div>
        </div>

        <Btn variant="primary" size="lg" onClick={onGoToDashboard} full>
          Ir al panel principal
          <IcoArrow dir="right" size={14} color="#fff" />
        </Btn>
      </div>
    </div>
  )
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────

function WizardTopBar({
  currentStep,
  totalSteps,
  onSaveAndExit,
}: {
  currentStep: number
  totalSteps: number
  onSaveAndExit: () => void
}) {
  return (
    <div className="h-12 bg-white border-b border-zinc-200 flex items-center px-5 gap-3 flex-shrink-0">
      <div className="flex-1" />
      <span className="text-xs text-zinc-400">
        Paso{' '}
        <span className="text-zinc-700 font-medium">{Math.min(currentStep + 1, totalSteps)}</span>
        {' '}de{' '}
        <span className="font-medium text-zinc-700">{totalSteps}</span>
      </span>
      <Btn variant="ghost" size="sm" onClick={onSaveAndExit}>
        Guardar y salir
      </Btn>
    </div>
  )
}

// ─── MAIN WIZARD ─────────────────────────────────────────────────────────────

const DEFAULT_DATA: WizardData = {
  company: {},
  modules: ['ventas', 'inventario'],
  products: [{ nombre: '', sku: '', precio: '', categoria: '', stock: '' }],
  sales: { tipoFactura: 'A', moneda: 'ARS', condPago: '30', iva: '21', incluirIVA: false, puntoVenta: '' },
  integrations: [],
  users: [],
}

export function OnboardingWizardClient({
  orgId,
  userEmail,
  userName,
  initialData,
}: Props) {
  const router = useRouter()
  const storageKey = `andiko-onboarding-${orgId}`

  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 0
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      return typeof saved.step === 'number' ? saved.step : 0
    } catch {
      return 0
    }
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
    return initialData ? { ...DEFAULT_DATA, ...initialData } : DEFAULT_DATA
  })

  const [completed, setCompleted] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      return Array.isArray(saved.completed) ? (saved.completed as string[]) : []
    } catch {
      return []
    }
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
    async (d: WizardData) => {
      try {
        await fetch('/api/v1/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: d, complete: false }),
        })
      } catch {
        /* non-blocking */
      }
    },
    [],
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
      await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, complete: true }),
      })
      localStorage.removeItem(storageKey)
      router.push('/')
    } catch {
      // Still redirect — data saved locally anyway
      router.push('/')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndExit = async () => {
    await saveProgress(data)
    router.push('/')
  }

  const currentId = STEPS[step]?.id
  const isDoneStep = currentId === 'done'
  const displaySteps = STEPS.filter(s => s.id !== 'done')

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
        return <StepDone data={data} onGoToDashboard={handleComplete} />
      default:
        return null
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-50">
      <WizardTopBar
        currentStep={step}
        totalSteps={displaySteps.length}
        onSaveAndExit={handleSaveAndExit}
      />
      <div className="flex-1 flex overflow-hidden">
        {!isDoneStep && (
          <ProgressRail
            currentStep={step}
            completedSteps={completed}
            onJump={jumpTo}
          />
        )}
        <div className="flex-1 flex overflow-hidden bg-zinc-50">
          {renderStep()}
        </div>
      </div>
      {saving && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded px-5 py-3 text-sm text-zinc-700 shadow-lg">
            Guardando configuración...
          </div>
        </div>
      )}
    </div>
  )
}
