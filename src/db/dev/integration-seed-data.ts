/**
 * Shared fixtures for integration tests and `pnpm db:seed-dev`.
 * Keep credentials and entity names in sync with tests/integration/features.
 */

export const INTEGRATION_TEST_PASSWORD = 'Test123456!'

export const INTEGRATION_TENANT = {
  name: 'Integration Tests',
  slug: 'integration',
  branch: { name: 'Casa Central', address: 'Av. Integration 100' },
} as const

export const INTEGRATION_TEST_USERS = {
  admin: {
    email: 'test-admin@andiko.local',
    password: INTEGRATION_TEST_PASSWORD,
    name: 'Test Admin',
    role: 'admin' as const,
  },
  gerente: {
    email: 'test-gerente@andiko.local',
    password: INTEGRATION_TEST_PASSWORD,
    name: 'Test Gerente',
    role: 'admin' as const,
  },
  vendedor: {
    email: 'test-vendedor@andiko.local',
    password: INTEGRATION_TEST_PASSWORD,
    name: 'Test Vendedor',
    role: 'operator' as const,
  },
  comprador: {
    email: 'test-comprador@andiko.local',
    password: INTEGRATION_TEST_PASSWORD,
    name: 'Test Comprador',
    role: 'operator' as const,
  },
  contador: {
    email: 'test-contador@andiko.local',
    password: INTEGRATION_TEST_PASSWORD,
    name: 'Test Contador',
    role: 'operator' as const,
  },
}

export const INTEGRATION_SUPPLIERS = [
  {
    legal_name: 'Proveedor Químicos',
    trade_name: 'Proveedor Químicos',
    cuit: '20123456789',
    email: 'contacto@quimicos.ar',
    phone: '0261-4123456',
  },
  {
    legal_name: 'Importadora de Resinas',
    trade_name: 'Importadora de Resinas',
    cuit: '20987654321',
    email: 'ventas@importadora.ar',
    phone: '0261-4000001',
  },
] as const

export const INTEGRATION_CUSTOMERS = [
  {
    legal_name: 'Cliente XYZ',
    trade_name: 'Cliente XYZ',
    cuit: '20555666777',
    email: 'contacto@clientexyz.ar',
    phone: '0261-4987654',
  },
  {
    legal_name: 'Distribuidora ABC',
    trade_name: 'Distribuidora ABC',
    cuit: '20888999000',
    email: 'pedidos@distribuidora.ar',
    phone: '0261-4111111',
  },
  {
    legal_name: 'Cliente ABC',
    trade_name: 'Cliente ABC',
    cuit: '20111222333',
    email: 'contacto@clienteabc.ar',
    phone: '0261-4222222',
  },
] as const

export type IntegrationProductSeed = {
  sku: string
  name: string
  category: string
  categorySlug: string
  costPrice: string
  salePrice: string
  unit: 'kg' | 'litro' | 'unidad'
  stock: number
}

export const INTEGRATION_PRODUCTS: IntegrationProductSeed[] = [
  {
    sku: 'RES-001',
    name: 'Resina Epóxica',
    category: 'Materias Primas',
    categorySlug: 'materias-primas',
    costPrice: '150.50',
    salePrice: '250.00',
    unit: 'kg',
    stock: 50,
  },
  {
    sku: 'CAT-001',
    name: 'Catalizador',
    category: 'Materias Primas',
    categorySlug: 'materias-primas',
    costPrice: '75.25',
    salePrice: '125.00',
    unit: 'litro',
    stock: 30,
  },
  {
    sku: 'MDF-001',
    name: 'Tablero MDF 18mm',
    category: 'Materiales',
    categorySlug: 'materiales',
    costPrice: '45.00',
    salePrice: '85.00',
    unit: 'unidad',
    stock: 20,
  },
  {
    sku: 'PINTURA-001',
    name: 'Pintura Poliuretánica',
    category: 'Insumos',
    categorySlug: 'insumos',
    costPrice: '120.00',
    salePrice: '200.00',
    unit: 'litro',
    stock: 15,
  },
  {
    sku: 'PROD-A',
    name: 'Producto A',
    category: 'Insumos',
    categorySlug: 'insumos',
    costPrice: '80.00',
    salePrice: '120.00',
    unit: 'unidad',
    stock: 50,
  },
  {
    sku: 'PROD-B',
    name: 'Producto B',
    category: 'Insumos',
    categorySlug: 'insumos',
    costPrice: '60.00',
    salePrice: '100.00',
    unit: 'unidad',
    stock: 30,
  },
]
