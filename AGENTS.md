<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
# AGENTS.md — Andiko ERP

## Project Overview

Andiko is a modular ERP for SMBs in Argentina. Stack: Next.js (App Router), TypeScript, Sequelize ORM, PostgreSQL. Modules: sales, inventory, purchases, accounting, contacts. Argentine business context: AFIP compliance, ARS currency, fiscal documents.

**Package manager:** `pnpm` only. Never `npm` or `yarn`.  
**Test framework:** Vitest. Never Jest.  
**Commit format:** Conventional Commits enforced by `commitlint`. Scope is required and must be a module name.

---

## Branching Model

```
main        ← versioned releases only (tags + CHANGELOG). Never commit directly.
develop     ← integration branch. Always deployable. Never commit directly.
feature/*   ← one branch per feature, branched off develop.
release/*   ← cut from develop, merged into main, back-merged into develop.
```

- Features ship via `/ship-feature` → PR into `develop`.
- Releases ship via `/release` → `release-it` handles version bump, CHANGELOG, tag, GitHub Release.
- Never bypass pre-commit hooks (`--no-verify` is forbidden).

---

## Core Principles

- Correctness over cleverness. ERP data is financial — bugs cost real money.
- Explicit over implicit. No magic, no hidden defaults.
- Consistency is non-negotiable. One way to do each thing across all modules.
- Never sacrifice data integrity for DX or performance.
- If unsure, do less. Don't invent behavior not explicitly requested.

---

## Architecture Guidelines

- All business logic lives in service files (`/services`), never in routes or models.
- Routes are thin: validate input → call service → return response.
- Models define structure and associations only. No business logic in models.
- Shared types go in `/types`. Never duplicate type definitions.
- Module structure: `sales/`, `inventory/`, `purchases/`, `contacts/`, `accounting/` — each with its own routes, services, and models.
- No circular dependencies between modules. Use event bus or shared services for cross-module logic.

---

## PostgreSQL Rules (Critical)

- PostgreSQL is the only supported database. Never write MySQL-compatible SQL.
- Use PostgreSQL-native features: `JSONB`, `ARRAY`, `ENUM` types, CTEs, window functions, `ON CONFLICT`, partial indexes.
- Always use `RETURNING` on `INSERT`/`UPDATE` when you need the result row.
- Use `UUID` (`gen_random_uuid()`) as primary keys — not auto-increment integers.
- Use `TIMESTAMPTZ` (not `TIMESTAMP`) for all datetime columns.
- Enforce constraints at the database level: `NOT NULL`, `CHECK`, `UNIQUE`, `FOREIGN KEY`.
- Never rely on application-level validation alone for data integrity.
- Use `NUMERIC(15,2)` for all monetary amounts. Never `FLOAT` or `DOUBLE`.
- Prefer partial indexes for soft-deleted records: `WHERE deleted_at IS NULL`.
- Avoid full-table scans: all foreign keys must be indexed.

---

## Sequelize Usage Rules

- Always use TypeScript models with strict typing (`Model<Attributes, CreationAttributes>`).
- Never use `sync({ force: true })` or `sync({ alter: true })` in any environment.
- All schema changes go through migrations — never through model sync.
- Use `findOne` with explicit `attributes` and `include` — never naked `findAll` on large tables.
- Always pass `transaction` to every Sequelize call inside a transaction block.
- Use `Op` from `sequelize` — never raw SQL strings for conditions unless using `sequelize.query`.
- Raw queries (`sequelize.query`) are allowed for complex reporting — use `QueryTypes` explicitly.
- Never use `Model.build()` without saving. Use `Model.create()` or explicit `save()`.
- Associations must be defined bidirectionally with explicit `foreignKey` and `as`.

---

## Migrations Strategy

- One migration per logical change. Never batch unrelated changes.
- Migration filenames: `YYYYMMDDHHMMSS-verb-subject.ts` (e.g., `20240315120000-add-tax-rate-to-products.ts`).
- Migrations must be reversible: always implement `down()`.
- Never modify an existing migration. Create a new one.
- All new columns must have a default or be nullable on creation — otherwise existing rows break.
- Add indexes in the same migration as the column, not separately.
- Test migrations on a copy of production data before deploying.

---

## Transactions (ERP-Critical)

- Every operation that touches more than one table MUST use a transaction.
- Sales flow (order → invoice → inventory deduction → payment) is a single transaction.
- Purchase flow (purchase order → receipt → inventory addition → payable) is a single transaction.
- Payment registration MUST update both the payment record and the document balance atomically.
- Use `sequelize.transaction()` with `async/await` — never callback-style.
- On transaction failure, always log the error with full context before rethrowing.
- Never commit partial state. If one step fails, the entire operation fails.

```typescript
// Correct pattern
const result = await sequelize.transaction(async (t) => {
  const invoice = await Invoice.create(data, { transaction: t });
  await updateInventory(items, { transaction: t });
  return invoice;
});
```

---

## Data Modeling Rules

**Money**
- Store as `NUMERIC(15,2)` in the database. `Decimal.js` in application code.
- Never do math with JavaScript `number` on monetary values.
- Always store tax amounts separately from base amounts (Argentine AFIP requirement).

**Timestamps**
- All tables: `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`.
- Soft delete everywhere — never hard delete business records.
- Use Sequelize `paranoid: true` for soft delete.

**Constraints**
- Prices, quantities, rates: `CHECK (value >= 0)`.
- Status columns: PostgreSQL `ENUM` or `VARCHAR` with `CHECK` constraint — never free text.
- Fiscal document numbers: `UNIQUE` constraint at DB level.

**References**
- All Argentine fiscal fields (CUIT, CBU, CUIL) stored as `VARCHAR`, never parsed as integers.
- Tax rates (IVA): stored as decimal (0.21 = 21%), not percentage integers.

---

## Naming Conventions

**Database (PostgreSQL)**
- Tables: `snake_case`, plural (`sales_orders`, `invoice_items`, `payment_methods`)
- Columns: `snake_case` (`tax_amount`, `due_date`, `created_at`)
- Indexes: `idx_{table}_{column(s)}` (`idx_invoices_customer_id`)
- Foreign keys: `fk_{table}_{referenced_table}` (`fk_invoice_items_invoices`)
- Enums: `snake_case` values (`pending`, `in_progress`, `completed`)

**Application (TypeScript)**
- Models: `PascalCase` singular (`SalesOrder`, `InvoiceItem`)
- Services: `camelCase` functions (`createInvoice`, `updateInventoryOnSale`)
- Route files: `kebab-case` (`sales-orders.ts`, `invoice-items.ts`)
- Constants: `UPPER_SNAKE_CASE`

---

## API Design Principles

- REST only. No GraphQL.
- Routes: `/api/v1/{module}/{resource}` (`/api/v1/sales/invoices`)
- Standard verbs: `GET` list/detail, `POST` create, `PATCH` update, `DELETE` soft-delete.
- Pagination: always cursor or offset+limit. Never return unbounded lists.
- Filtering: query params, validated and sanitized before hitting the DB.
- Error responses: `{ error: string, code: string, details?: object }` — always structured.
- Never expose internal IDs in URLs when UUID is available.
- HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 409 Conflict, 422 Unprocessable, 500 Internal.
- Validate request body with Zod at the route level before calling services.

---

## UX / Product Constraints

- ERP users repeat the same workflow dozens of times per day. Optimize for speed, not discovery.
- Minimize clicks for core flows: create invoice, receive payment, register purchase.
- Default values everywhere: today's date, current user, last used customer.
- Keyboard-first: forms must be fully operable without a mouse.
- Never show a loading spinner for operations under 300ms.
- Inline editing preferred over modal dialogs for simple fields.
- List views: sortable columns, persistent filters (saved in URL params or localStorage).
- Always show running totals on multi-line forms (invoice items, purchase orders).
- Errors must be shown inline, never only in a toast/alert.
- Mobile is secondary — desktop workflows are the priority.

---

## Anti-Patterns

- **No `any` in TypeScript.** Use `unknown` and narrow, or define the type.
- **No business logic in Next.js API routes.** Routes call services, nothing else.
- **No `Model.update()` without a `where` clause.** Always scope updates.
- **No floating-point money math.** Use `Decimal.js` or store as cents if needed.
- **No soft-delete bypass.** Always query with `WHERE deleted_at IS NULL` (Sequelize paranoid handles this — don't disable it).
- **No upsert on financial documents.** Invoices, payments, and fiscal records are immutable once created. Use status transitions instead.
- **No `console.log` in production code.** Use the structured logger.
- **No direct DB access from frontend.** No Prisma client-side, no exposed connection strings.
- **No schema changes in application startup.** Migrations only.
- **No unbounded queries.** Every list query must have a `LIMIT`.
- **No magic strings.** Use constants or enums for status values, document types, tax codes.

---

## Decision Heuristics

**When adding a new field:**
→ Add a migration. Add a DB constraint. Add a Zod validator. Update the TypeScript type. In that order.

**When a module needs data from another module:**
→ Use a service call, not a direct model import from another module's internals.

**When a user action modifies financial state:**
→ Wrap in a transaction. Log before and after. Return the final state.

**When unsure about a data type:**
→ Use `VARCHAR` with a `CHECK` constraint over an `ENUM` if values may grow. Use `NUMERIC(15,2)` for anything money-adjacent.

**When a query is slow:**
→ Check indexes first. Use `EXPLAIN ANALYZE`. Add a partial index if filtering by status + deleted_at.

**When asked to delete data:**
→ Default to soft delete. Only hard delete if explicitly requested and the record has no financial dependencies.

**When writing a new API endpoint:**
→ Define the Zod schema first. Then the service. Then the route. Never the other way around.

**When a rule in this file conflicts with a framework default:**
→ This file wins.
