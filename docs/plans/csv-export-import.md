# Plan: CSV Export / Import — Feature

## Context

Los usuarios del ERP necesitan poder exportar datos a CSV para análisis externo (Excel, etc.) y cargar datos masivos desde CSV para migraciones o actualizaciones en lote. El diseño debe ser **extensible**: cualquier listado del ERP debe poder adoptar export/import siguiendo el mismo patrón. El import incluye un selector de acción estilo WooCommerce para que el usuario controle el comportamiento ante registros existentes.

---

## Arquitectura general

### Capa de utilidades CSV (`src/lib/csv.ts`)
Funciones puras, sin dependencias externas (no instalar librería; Node.js y el browser tienen suficiente con la API estándar).

```typescript
type CsvHeader = { key: string; label: string }
type ParsedCsv = { headers: string[]; rows: Record<string, string>[] }

export function toCsvText(rows: Record<string, unknown>[], headers: CsvHeader[]): string
export function parseCsvText(text: string): ParsedCsv  // RFC 4180, maneja comillas y comas
```

### Adapter por módulo (`src/modules/<module>/csv-adapter.ts`)
Cada módulo define su propio adaptador. Este es el único archivo nuevo por módulo.

```typescript
export interface CsvAdapter<TEntity, TInput> {
  headers: CsvHeader[]                          // columnas del CSV
  toRow: (entity: TEntity) => Record<string, string>   // entity → CSV row
  fromRow: (row: Record<string, string>) => TInput     // CSV row → service input
  matchKey: string                              // campo clave para upsert (ej: 'cuit', 'sku')
}
```

### Export endpoint (por módulo)
```
GET /api/v1/<module>/<resource>/export
  - Acepta los mismos query params que el list (search, type, etc.)
  - Sin paginación (limit máximo configurable, ej: 10.000)
  - Responde con Content-Type: text/csv + Content-Disposition: attachment
```

### Import endpoint (por módulo)
```
POST /api/v1/<module>/<resource>/import
  Body: FormData {
    file: File,
    action: 'create' | 'update' | 'upsert',
    mapping: string  // JSON: Record<fieldKey, csvColumn>  e.g. { "cuit": "CUIT Empresa", "email": "Mail" }
  }
  Response: { created: n, updated: n, skipped: n, errors: [{ row: n, message: string }] }
```

### UI — componente genérico `ImportModal`
`src/components/erp/ImportModal.tsx`

Flujo de 4 pasos (wizard):

**Paso 1 — Subir archivo**
- Input file (acepta `.csv`)
- Al seleccionar, parsea los headers del CSV en el cliente (sin upload aún)

**Paso 2 — Mapear columnas**
- Para cada campo esperado del módulo, un `<select>` con las columnas detectadas del CSV
- Pre-mapeo automático por nombre exacto o similar (case-insensitive)
- El usuario puede reasignar o marcar "Ignorar" para columnas no necesarias
- Campos requeridos muestran error si no están mapeados

**Paso 3 — Configurar acción y confirmar**
- Select: "Solo crear nuevos" / "Solo actualizar existentes" / "Crear y actualizar (upsert)"
- Resumen: N filas detectadas, campos mapeados
- POST al endpoint con `{ file, mapping: Record<fieldKey, csvColumn>, action }`

**Paso 4 — Resultado**
- Resumen: `created: N, updated: N, skipped: N`
- Tabla de errores por fila si los hay (fila #, campo, mensaje)

---

## Implementación: Contactos (referencia)

Contactos es el primer módulo completo. Los demás siguen el mismo patrón.

### Archivos nuevos
| Archivo | Descripción |
|---|---|
| `src/lib/csv.ts` | Utilidades genéricas (toCsvText, parseCsvText) |
| `src/components/erp/ImportModal.tsx` | Modal genérico reutilizable |
| `src/modules/contacts/contacts-csv-adapter.ts` | Adapter de Contactos |
| `src/app/api/v1/contacts/export/route.ts` | GET export |
| `src/app/api/v1/contacts/import/route.ts` | POST import |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/app/(erp)/contactos/ContactosClient.tsx` | Agregar botones "Exportar CSV" e "Importar CSV" en toolbar |

### Columnas CSV de Contactos
`type, legal_name, trade_name, first_name, last_name, cuit, iva_condition, email, phone, is_active`

Clave de match: `cuit`

### Estrategias de import
- **create**: si `cuit` no existe → `createContact()`; si existe → skip (cuenta en `skipped`)
- **update**: si `cuit` existe → `updateContact()`; si no existe → skip
- **upsert**: si `cuit` existe → `updateContact()`; si no → `createContact()`
- Contactos sin `cuit` usan `legal_name` como clave de fallback

### Validación del import
- Cada fila pasa por `contactSchema` / `contactUpdateSchema` (Zod, ya existente en `src/modules/contacts/contact.schema.ts`)
- Errores de fila no detienen el proceso; se acumulan en `errors[]`
- Todo el import corre en una sola transacción Sequelize — si hay errores se hace rollback total

---

## Extensibilidad: agregar CSV a un módulo nuevo

1. Crear `src/modules/<module>/<resource>-csv-adapter.ts` con `CsvAdapter`
2. Crear `src/app/api/v1/<module>/<resource>/export/route.ts` (copiar de contacts)
3. Crear `src/app/api/v1/<module>/<resource>/import/route.ts` (copiar de contacts)
4. En el Client component: agregar botones y `<ImportModal>` con las props del módulo

---

## Archivos críticos de referencia

- `src/modules/contacts/contacts.service.ts` — `createContact`, `updateContact`, `listContacts`
- `src/modules/contacts/contact.schema.ts` — `contactSchema`, `contactUpdateSchema`, `contactQuerySchema`
- `src/modules/contacts/contact.model.ts` — `ContactAttributes`
- `src/lib/fetch-json.ts` — `fetchJson`, `ApiRequestError`
- `src/lib/notify.ts` — `notifySuccess`, `notifyApiError`
- `src/components/erp/DataTable.tsx` — para saber dónde insertar botones de toolbar
- `src/app/api/v1/contacts/route.ts` — patrón de ruta con `withPermission`

---

## Verificación

1. **Export**:
   - Ir a `/contactos`, hacer clic en "Exportar CSV"
   - El browser descarga `contactos.csv` con headers correctos y todos los registros filtrados

2. **Import create**:
   - Preparar CSV con contactos nuevos (sin CUIT existente)
   - Seleccionar "Solo crear nuevos" → resultado: `created: N, updated: 0`

3. **Import update**:
   - Preparar CSV modificando `email` de contactos existentes
   - Seleccionar "Solo actualizar existentes" → resultado: `updated: N, created: 0`

4. **Import upsert con errores**:
   - CSV con una fila válida (nueva) + una fila con `iva_condition` inválida
   - Resultado: rollback completo, `errors: [{ row: 2, message: '...' }]`

5. **Extensibilidad**: confirmar que el mismo `ImportModal` funciona sin cambios en Catálogo (con su propio adapter)
