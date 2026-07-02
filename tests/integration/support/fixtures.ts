import {
  INTEGRATION_CUSTOMERS,
  INTEGRATION_PRODUCTS,
  INTEGRATION_SUPPLIERS,
  INTEGRATION_TEST_PASSWORD,
  INTEGRATION_TEST_USERS,
} from '@/db/dev/integration-seed-data'

export const TEST_USERS = {
  admin: {
    email: INTEGRATION_TEST_USERS.admin.email,
    password: INTEGRATION_TEST_USERS.admin.password,
    role: 'admin',
  },
  gerente: {
    email: INTEGRATION_TEST_USERS.gerente.email,
    password: INTEGRATION_TEST_USERS.gerente.password,
    role: 'manager',
  },
  vendedor: {
    email: INTEGRATION_TEST_USERS.vendedor.email,
    password: INTEGRATION_TEST_USERS.vendedor.password,
    role: 'sales',
  },
  comprador: {
    email: INTEGRATION_TEST_USERS.comprador.email,
    password: INTEGRATION_TEST_USERS.comprador.password,
    role: 'purchasing',
  },
  contador: {
    email: INTEGRATION_TEST_USERS.contador.email,
    password: INTEGRATION_TEST_USERS.contador.password,
    role: 'accounting',
  },
}

export const TEST_SUPPLIERS = INTEGRATION_SUPPLIERS.map((supplier) => ({
  name: supplier.legal_name,
  cuit: supplier.cuit,
  email: supplier.email,
  type: 'supplier' as const,
  paymentTerms: supplier.legal_name === 'Proveedor Químicos' ? 'net_30' : 'net_15',
}))

export const TEST_CUSTOMERS = INTEGRATION_CUSTOMERS.map((customer) => ({
  name: customer.legal_name,
  cuit: customer.cuit,
  email: customer.email,
  type: 'customer' as const,
  creditLimit: customer.legal_name === 'Cliente XYZ' ? 50000 : 100000,
}))

export const TEST_PRODUCTS = INTEGRATION_PRODUCTS.map((product) => ({
  code: product.sku,
  name: product.name,
  category: product.category,
  cost_price: Number(product.costPrice),
  sale_price: Number(product.salePrice),
  unit: product.unit,
  stock: product.stock,
}))

export const TEST_PURCHASE_ORDER = {
  supplier: 'Proveedor Químicos',
  items: [
    {
      productCode: 'RES-001',
      quantity: 10,
      unitPrice: 150.5,
    },
    {
      productCode: 'CAT-001',
      quantity: 5,
      unitPrice: 75.25,
    },
  ],
  expectedTotal: 2276.31,
}

export const TEST_SALES_ORDER = {
  customer: 'Cliente XYZ',
  items: [
    {
      productCode: 'RES-001',
      quantity: 2,
      discount: 0,
    },
    {
      productCode: 'CAT-001',
      quantity: 1,
      discount: 10,
    },
  ],
}

/** @internal re-export for steps that need the shared password */
export const TEST_PASSWORD = INTEGRATION_TEST_PASSWORD

/**
 * Generate a unique identifier for test runs
 * Useful for creating isolated data sets
 */
export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Parse a currency string to number
 * Handles both "1.234,56" and "1,234.56" formats
 */
export function parseCurrency(value: string): number {
  const cleaned = value.trim().replace(/[^\d,.-]/g, '')

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma > lastDot) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }

  return parseFloat(cleaned.replace(/,/g, ''))
}

/**
 * Format a number as ARS currency
 * Uses "." as thousands separator, "," as decimal
 */
export function formatARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value)
}
