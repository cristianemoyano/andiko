# Integration Tests - Andiko ERP

Esta carpeta contiene la suite de tests de integración end-to-end usando Gherkin/BDD con Cucumber y Playwright.

## Estructura

```
tests/integration/
├── features/           # Archivos Gherkin (.feature)
│   ├── auth.feature
│   ├── catalog.feature
│   ├── contacts.feature
│   ├── inventory.feature
│   ├── purchases.feature
│   ├── sales.feature
│   └── financials.feature
├── steps/             # Step definitions (TypeScript)
│   ├── auth.steps.ts
│   ├── catalog.steps.ts
│   ├── common.steps.ts
│   ├── contacts.steps.ts
│   ├── financials.steps.ts
│   ├── purchases.steps.ts
│   └── sales.steps.ts
└── support/           # Configuración compartida
    ├── fixtures.ts    # Test data (usuarios, proveedores, productos)
    ├── hooks.ts       # Before/After hooks
    └── world.ts       # Cucumber World (contexto compartido)
```

## Ejecución

### Desarrollo local

```bash
# Levantar la app en terminal 1
pnpm dev

# Ejecutar tests en terminal 2
pnpm test:integration

# O con modo watch (se recargan al editar .feature o .steps.ts)
pnpm test:integration:watch
```

### Con interfaz visual (headful)

Para ver el navegador mientras corren los tests:

```bash
HEADLESS=false pnpm test:integration
```

### En CI/CD

```bash
pnpm test:integration:ci
```

Corre 4 tests en paralelo, genera reportes HTML/JSON/XML.

## Reportes

Los reportes se generan en `test-results/`:

- **cucumber-report.html** — Reporte HTML (abrir en navegador)
- **cucumber-report.json** — Formato JSON para CI/CD
- **cucumber-report.xml** — Formato JUnit para Jenkins/GitLab

## Escribir Nuevos Tests

### 1. Crear archivo .feature en español

```gherkin
# language: es
Característica: Mi Característica
  Como usuario
  Quiero hacer algo
  Para lograr un objetivo

  Escenario: Descripción del caso
    Dado estoy autenticado como "admin"
    Cuando hago algo
    Entonces veo un resultado
```

**Importante:** La primera línea debe ser `# language: es` para activar el parser en español.

### 2. Implementar step definitions en TypeScript

```typescript
// steps/myfeature.steps.ts
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'

When('hago algo', async function (this: World) {
  await this.goto('/erp/mypage')
  await this.page.click('button:has-text("Click me")')
  
  // Guardar resultado para pasos posteriores
  this.lastResult.value = await this.page.locator('#result').textContent()
})

Then('veo un resultado', async function (this: World) {
  const result = this.lastResult.value
  expect(result).toContain('esperado')
})
```

### 3. Reutilizar steps compartidos

Los steps en `common.steps.ts` están disponibles en todos los tests. Ejemplos:

```gherkin
# Navegación y UI
Dado estoy autenticado como "admin"
Cuando navego a "/erp/sales"
Entonces veo el título "Ventas"
Y el elemento "#sidebar" es visible

# Formularios
Cuando completo el formulario con:
  | Campo   | Valor  |
  | nombre  | Juan   |
  | email   | j@test |
Entonces veo el mensaje "Creado exitosamente"

# Tablas
Entonces veo 5 filas en la tabla
Y la tabla contiene "Cliente XYZ"
```

### 4. Patrón: Test data en el World

```typescript
// En fixtures.ts
export const TEST_USERS = {
  admin: { email: '...', password: '...' },
}

// En steps
Given('estoy autenticado como {string}', async function (this: World, role: string) {
  const user = TEST_USERS[role as keyof typeof TEST_USERS]
  this.testData.user = user  // Guardar para pasos posteriores
  await this.login(user.email, user.password)
})
```

## API Disponible en World

```typescript
// this.page → Página de Playwright (locator, click, fill, etc.)
await this.page.locator('selector').fill('value')

// this.goto(path) → Navegar a ruta relativa
await this.goto('/erp/sales')

// this.fillForm(data) → Llenar formulario de una vez
await this.fillForm({ nombre: 'Juan', email: 'j@test' })

// this.testData → Guardar datos entre steps
this.testData.customer = { name: 'XYZ' }

// this.lastResult → Capturar resultados de acciones
this.lastResult.invoiceId = '001-001-00000001'

// this.apiCall() → Llamar API directamente (sin UI)
const result = await this.apiCall('POST', '/contacts', { name: '...' })
```

## Buenas Prácticas

### ✅ DO

- Usar español en comentarios y descripciones
- Un escenario por flujo lógico completo
- Reutilizar steps (DRY)
- Guardar datos en `this.testData` para pasos posteriores
- Incluir validaciones en `Then` steps
- Usar `data tables` para datos complejos

### ❌ DON'T

- Mezclar inglés y español en código
- Tests demasiado cortos (1-2 steps)
- Hardcodear valores; usar fixtures
- Afirmaciones en `When` steps (las afirmaciones van en `Then`)
- Esperar tiempos fijos (usar `waitForURL`, `waitForSelector`, etc.)

## Fixtures y Test Data

Editar `tests/integration/support/fixtures.ts`:

```typescript
export const TEST_USERS = {
  admin: { email: '...', password: '...' },  // Ya existe
  // Agregar más roles según sea necesario
}

export const TEST_SUPPLIERS = [
  // Agregar proveedores de test
]

export const TEST_PRODUCTS = [
  // Agregar productos de test
]
```

## Debugging

### Ver logs en consola

```typescript
When('hago algo', async function (this: World) {
  console.log('URL actual:', this.page.url())
  console.log('Test data:', this.testData)
  console.log('Último resultado:', this.lastResult)
})
```

### Screenshots on failure

Los screenshots se guardan automáticamente en `test-results/{scenario-id}.png` al fallar.

### Pausa interactiva

```typescript
await this.page.pause() // Abre DevTools, pausa la ejecución
```

## Troubleshooting

### "Test timeout"

Aumentar timeout en `support/world.ts`:

```typescript
setDefaultTimeout(60 * 1000) // 60 segundos
```

### "Element not found"

Verificar:
- ¿El selector es correcto?
- ¿El elemento está visible? → `await expect(element).toBeVisible()`
- ¿Hay que esperar carga de datos? → `await page.waitForURL(...)`

### "Session expired"

El World.ts maneja sesiones automáticamente. Si hay problemas:
- Verificar credenciales en `fixtures.ts`
- Revisar que los usuarios existan en la BD

## Referencias

- [Cucumber.js docs](https://github.com/cucumber/cucumber-js)
- [Playwright API](https://playwright.dev/docs/api/class-playwright)
- [Gherkin en español](https://cucumber.io/docs/gherkin/languages/)

---

¿Dudas? Revisar los archivos `.steps.ts` existentes como referencia.
