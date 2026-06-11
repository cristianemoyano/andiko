import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

export interface OnboardingData {
  company?: {
    razonSocial?: string
    cuit?: string
    condicionIVA?: string
    nombreComercial?: string
    actividad?: string
    calle?: string
    ciudad?: string
    provincia?: string
    cp?: string
    pais?: string
    telefono?: string
    email?: string
  }
  modules?: string[]
  productsMode?: 'manual' | 'csv' | 'later' | null
  integrations?: string[]
  sales?: {
    tipoFactura?: string
    puntoVenta?: string
    moneda?: string
    iva?: string
    incluirIVA?: boolean
    condPago?: string
  }
}

export const ORG_IVA_CONDITIONS = [
  'responsable_inscripto',
  'monotributista',
  'consumidor_final',
  'exento',
  'no_responsable',
] as const
export type OrgIvaCondition = typeof ORG_IVA_CONDITIONS[number]

export interface OrganizationAttributes extends Timestamps {
  id: UUID
  name: string
  slug: string
  is_active: boolean
  legal_name: string | null
  cuit: string | null
  iva_condition: OrgIvaCondition | null
  fiscal_address: string | null
  onboarding_completed_at: Date | null
  onboarding_data: OnboardingData | null
}

type OrganizationCreationAttributes = Optional<
  OrganizationAttributes,
  | 'id' | 'is_active' | 'legal_name' | 'cuit' | 'iva_condition' | 'fiscal_address'
  | 'onboarding_completed_at' | 'onboarding_data' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class Organization extends Model<OrganizationAttributes, OrganizationCreationAttributes> {
  declare id: UUID
  declare name: string
  declare slug: string
  declare is_active: boolean
  declare legal_name: string | null
  declare cuit: string | null
  declare iva_condition: OrgIvaCondition | null
  declare fiscal_address: string | null
  declare onboarding_completed_at: Date | null
  declare onboarding_data: OnboardingData | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Organization.init(
  {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:      { type: DataTypes.STRING(255), allowNull: false },
    slug:      { type: DataTypes.STRING(100), allowNull: false, unique: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    legal_name: { type: DataTypes.STRING(255), allowNull: true },
    cuit: { type: DataTypes.STRING(13), allowNull: true },
    iva_condition: { type: DataTypes.STRING(30), allowNull: true },
    fiscal_address: { type: DataTypes.STRING(500), allowNull: true },
    onboarding_completed_at: { type: DataTypes.DATE, allowNull: true },
    onboarding_data: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'organizations', paranoid: true, underscored: true }
)

export default Organization
