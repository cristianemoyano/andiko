// Test user credentials (these would need to be created via migrations or fixtures)
export const TEST_USERS = {
  admin: {
    email: 'test-admin@andiko.local',
    password: 'Test123456!',
    role: 'admin',
  },
  gerente: {
    email: 'test-gerente@andiko.local',
    password: 'Test123456!',
    role: 'manager',
  },
  vendedor: {
    email: 'test-vendedor@andiko.local',
    password: 'Test123456!',
    role: 'sales',
  },
  comprador: {
    email: 'test-comprador@andiko.local',
    password: 'Test123456!',
    role: 'purchasing',
  },
}

export const TEST_SUPPLIERS = [
  {
    name: 'Proveedor Químicos',
    cuit: '20123456789',
    email: 'contacto@quimicos.ar',
    type: 'supplier',
    paymentTerms: 'net_30',
  },
  {
    name: 'Importadora de Resinas',
    cuit: '20987654321',
    email: 'ventas@importadora.ar',
    type: 'supplier',
    paymentTerms: 'net_15',
  },
]

export const TEST_CUSTOMERS = [
  {
    name: 'Cliente XYZ',
    cuit: '20555666777',
    email: 'contacto@clientexyz.ar',
    type: 'customer',
    creditLimit: 50000,
  },
  {
    name: 'Distribuidora ABC',
    cuit: '20888999000',
    email: 'pedidos@distribuidora.ar',
    type: 'customer',
    creditLimit: 100000,
  },
]

export const TEST_PRODUCTS = [
  {
    code: 'RES-001',
    name: 'Resina Epóxica',
    category: 'Materias Primas',
    costPrice: 150.5,
    salePrice: 250.0,
    unit: 'kg',
    stock: 0, // Initially empty, will be filled via purchase
  },
  {
    code: 'CAT-001',
    name: 'Catalizador',
    category: 'Materias Primas',
    costPrice: 75.25,
    salePrice: 125.0,
    unit: 'ltr',
    stock: 0,
  },
  {
    code: 'MDF-001',
    name: 'Tablero MDF 18mm',
    category: 'Materiales',
    costPrice: 45.0,
    salePrice: 85.0,
    unit: 'plc',
    stock: 0,
  },
  {
    code: 'PINTURA-001',
    name: 'Pintura Poliuretánica',
    category: 'Insumos',
    costPrice: 120.0,
    salePrice: 200.0,
    unit: 'ltr',
    stock: 0,
  },
]

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
  expectedTotal: 1752.75,
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
  // Remove any spaces
  value = value.trim()

  // Detect format based on last separator
  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')

  if (lastComma > lastDot) {
    // European format: 1.234,56 → 1234.56
    return parseFloat(value.replace(/\./g, '').replace(',', '.'))
  } else {
    // US format: 1,234.56 → 1234.56
    return parseFloat(value.replace(/,/g, ''))
  }
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
