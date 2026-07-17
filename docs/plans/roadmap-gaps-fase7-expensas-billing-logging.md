# Plan: Cierre de gaps del roadmap — Contabilidad (Fase 7) + quick wins

## Context

The user asked to read the code and `docs/ROADMAP.md` and fill the remaining gaps following best practices. Exploration showed most of the roadmap is done and some checkboxes are stale (auto-posting of journal entries from sales/purchases/payments/expenses is **fully implemented** — `src/modules/accounting/*-accounting.service.ts` hooked into every domain flow — but still unchecked). User approved this scope:

- **A. Contabilidad (Fase 7)**: Estado de resultados, Cierre de período, Exportación para estudio contable, plus roadmap hygiene.
- **B. Quick wins**: Expensas aging/cuenta corriente por proveedor; Billing suspensión de acceso en `past_due`; Logging (`LOG_LEVEL`, redacción pino, `handleApiError` centralizado).

**Branch:** `feature/roadmap-gaps-fase7-expensas-billing-logging` off `develop`, shipped via `/ship-feature`.
**Step 0 (project convention):** copy this plan to `docs/plans/roadmap-gaps-fase7-expensas-billing-logging.md` before implementing.
**Note (AGENTS.md):** before writing App Router code, check `node_modules/next/dist/docs/` for this Next.js version's conventions.

Commit sequence (scopes exist in `.commitlintrc.json`):
1. `feat(core): LOG_LEVEL, redacción de secretos en pino y handleApiError centralizado`
2. `feat(accounting): estado de resultados`
3. `feat(accounting): cierre de período contable`
4. `feat(accounting): exportación para estudio contable (libro diario y sumas y saldos CSV)`
5. `feat(expenses): aging y cuenta corriente por proveedor de expensas`
6. `feat(billing): suspensión de acceso al ERP con suscripción past_due`
7. `docs(accounting): roadmap — tildar ítems completados`

---

## Workstream 1 — Logging (core) — first, so new code relies on the net

1. **`LOG_LEVEL`**: add optional `LOG_LEVEL: z.enum(['trace','debug','info','warn','error','fatal'])` to `src/config/env.ts`; in `src/lib/logger.ts` use `env.LOG_LEVEL ?? (prod ? 'info' : 'debug')`.
2. **Redaction**: new pure `src/lib/log-redact.ts` with `REDACT_PATHS` (password, token, authorization, cookie, secret, apiKey/api_key, access_token, refresh_token, DATABASE_URL — top-level and `*.` variants) + `redactAttributes()` helper. Wire `redact: { paths, censor: '[Redacted]' }` into pino options. **Critical**: pino `redact` does NOT cover the `logMethod` hook — apply `redactAttributes()` inside `src/lib/posthog-otel-logs.ts` (`emitPinoLogToPostHog`) before shipping attributes to PostHog, otherwise redaction is cosmetic.
3. **`handleApiError`**: new `src/lib/api-error.ts` → maps `ZodError`→400 `VALIDATION_ERROR` (+flatten), `ForbiddenError` (`src/lib/permissions.ts`)→403, `TenancyError` (`src/lib/tenancy.ts`: `ORG_CONTEXT_REQUIRED`→422, `BRANCH_NOT_ALLOWED`→403), Sequelize Unique/FK constraint→409 `CONFLICT`, Sequelize ValidationError→422, else `logger.error` + 500 `{ error: 'Error interno del servidor.', code: 'INTERNAL' }`. Response shape stays `{ error, code, details? }`. **No sentinel string-matching** — the 246 routes keep local handling; the net only prevents unstructured 500s. Wrap `handler(...)` in try/catch at the 3 chokepoints in `src/lib/api-handler.ts`: `withPermission` (:100), `withTenantAnyPermission` (:151), `withTenantAuth` (:173) — `withTenantPermission`/`withOrgPermission` compose `withPermission`.
- Tests: `src/lib/log-redact.test.ts`, `src/lib/api-error.test.ts`.

## Workstream 2 — Contabilidad (Fase 7)

Pattern to mirror everywhere: the trial-balance vertical slice (`src/modules/accounting/reports.service.ts` `getTrialBalance`, `balance-sheet-summary.ts`, `journal-entry.schema.ts`, `src/app/api/v1/accounting/reports/trial-balance/route.ts`, `src/app/(erp)/contabilidad/balance/` + `ContabilidadSubNav.tsx`).

### 2.1 Estado de resultados
- Extend `getTrialBalance` with internal option `excludeSourceTypes?: string[]` (SQL `AND (e.source_type IS NULL OR e.source_type NOT IN (...))`). The income statement must exclude closing entries (`period_close`, `period_close_reversal`) or a closed period reports resultado 0; sumas y saldos keeps including them.
- New pure reducer `src/modules/accounting/income-statement-summary.ts`: groups income accounts (ingresos), expense `5.1*` (costo de ventas), `5.2*` (gastos operativos), `5.3*` (financieros), fallback "Otros egresos" for custom codes; totals with Decimal.js `.toFixed(2)`: `total_ingresos`, `total_costo`, `resultado_bruto`, `total_gastos`, `resultado_neto`.
- `getIncomeStatement(query, ctx)` in `reports.service.ts`; `incomeStatementQuerySchema = trialBalanceQuerySchema` (desde/hasta/sucursal).
- New route `src/app/api/v1/accounting/reports/income-statement/route.ts` (`withPermission('accounting:read')`), new page `src/app/(erp)/contabilidad/estado-de-resultados/page.tsx` + `EstadoDeResultadosClient.tsx` (mirror `BalanceClient.tsx`; client CSV export like `compras/reportes/ReportesClient.tsx`), sub-nav entry.
- Tests: `income-statement-summary.test.ts` (grouping, pérdida, custom-code fallback); extend `reports.service.test.ts`.

### 2.2 Cierre de período
Design decisions:
- New table `accounting_periods` to enforce "no posting into closed periods" and make close/reopen auditable.
- **Reopen = reversal entry, never delete** (immutability rule). Reversal uses same `entry_date` as closing entry.
- One posted closing entry per close: zero income/expense net balances against `3.2.02 Resultado del ejercicio` (exists in `default-chart.ts`); missing account → hard error `CLOSING_ACCOUNT_MISSING` (deliberate action, unlike non-fatal auto-post).
- **Late documents (main risk):** auto-posting must never fail a business op. In `createPostedEntry` (`accounting-auto-post.utils.ts`), clamp `entryDate` falling inside a closed period forward to the first open day, append "(período cerrado: reimputado)" to the description, `logger.warn`.
- Manual entries: `postEntry` (`journal-entries.service.ts` ~:235) throws `PERIOD_CLOSED` when `entry_date` is inside a closed period; requires making `postEntry` transactional (small refactor).

Files:
- Migration `src/db/migrations/20260716120000-create-accounting-periods.ts` (reversible): `id UUID gen_random_uuid()`, `org_id` FK+index, `start_date`/`end_date DATE NOT NULL` + `CHECK (start_date <= end_date)`, `status VARCHAR(20) CHECK IN ('closed','reopened') DEFAULT 'closed'`, nullable `closing_entry_id`/`reversal_entry_id` FK `journal_entries` (nullable breaks the creation cycle), audit cols, `TIMESTAMPTZ` timestamps, partial index `(org_id, end_date) WHERE deleted_at IS NULL AND status='closed'`.
- `accounting-period.model.ts` (paranoid), `accounting-period.schema.ts` (`closePeriodSchema` from/to + refine, list query), pure `period-close.utils.ts` (`buildClosingLines` → balanced `AutoPostLine[]`, skip zero balances).
- `period-close.service.ts`: `closePeriod` (single transaction: lock existing closed periods → reject overlap `PERIOD_OVERLAP` → aggregate income/expense in range → `NOTHING_TO_CLOSE` if empty → create period row → `createPostedEntry({ sourceType: 'period_close', sourceId: period.id, entryDate: to })` → set `closing_entry_id`; log before/after), `reopenPeriod` (lock, must be closed, swapped-side reversal entry `period_close_reversal`, status `reopened`), `listPeriodCloses`, `clampDateOutOfClosedPeriods` / closed-period lookup helpers, `CLOSING_SOURCE_TYPES` const.
- Routes: `src/app/api/v1/accounting/periods/route.ts` (GET `accounting:read`, POST `accounting:write`; `PERIOD_OVERLAP`→409, `NOTHING_TO_CLOSE`→422, `CLOSING_ACCOUNT_MISSING`→422), `.../periods/[id]/reopen/route.ts` (POST; 404/409).
- UI: `src/app/(erp)/contabilidad/cierres/page.tsx` + `CierresClient.tsx` — list (período, estado, links a asientos), form Cerrar período (default mes anterior) + `ConfirmDialog`, Reabrir + `ConfirmDialog`, `setRefresh(r => r + 1)` after mutations; UI copy notes the reimputación rule. Sub-nav entry "Cierres".
- Tests: `period-close.utils.test.ts` (ganancia/pérdida/mixed, balanced via `assertBalancedLines`), `period-close.service.test.ts` (overlap, reopen swap, clamp), extend `journal-entries.service.test.ts` (`PERIOD_CLOSED`).

### 2.3 Exportación para estudio contable
- Server-side CSV endpoints (large data; mirrors `src/app/api/v1/contacts/export/route.ts`), UTF-8 BOM, Spanish headers, `LIMIT 50000`.
- New `src/modules/accounting/accounting-export.service.ts`: `getLibroDiarioRows` (posted entries + lines + account code/name + branch, ordered `entry_date, entry_number, sort_order`); sumas y saldos reuses `getTrialBalance`.
- Routes `src/app/api/v1/accounting/export/libro-diario/route.ts` and `.../export/sumas-y-saldos/route.ts` (`withPermission('accounting:read')`, `text/csv` + `Content-Disposition` attachment).
- Page `src/app/(erp)/contabilidad/exportacion/page.tsx` + `ExportacionClient.tsx` (desde/hasta, download links). Sub-nav "Exportación".
- Test: `accounting-export.service.test.ts`.

### 2.4 Roadmap hygiene (`docs/ROADMAP.md`)
- Tick :521 asientos automáticos (note which source_types are implemented); fix stale ":538 auto-posting solo en devoluciones"; tick 526/527/528 (as delivered), 883, 510, 947; annotate 946 as partial (requestId/ALS out of scope).

## Workstream 3 — Expensas: aging + cuenta corriente

Mirror the Compras slice; gate with `expenses:read` (module consistency). Expenses without `contact_id` are excluded (noted in UI).
- New `src/modules/expenses/expenses-aging.schema.ts` (mirror `payablesAgingQuerySchema`).
- New `src/modules/expenses/expenses-payables-aging.service.ts`: near-copy of `src/modules/purchases/payables-aging.service.ts` over `expenses` with `OPEN_PAYABLE_EXPENSE_STATUSES` (`expense.constants.ts`) + `contact_id IS NOT NULL`; buckets current/1_30/31_60/61_90/90_plus, `HAVING balance > 0`, pagination + totals.
- New `src/modules/expenses/expense-supplier-statement.service.ts`: mirror `purchases/supplier-account-statement.service.ts` with `Expense` (debit=`total`, skip draft/cancelled) + `ExpensePayment` (credit); reuse `accountStatementQuerySchema` from `@/modules/sales/account-statement.schema` (as purchases does).
- Routes: `src/app/api/v1/expenses/reports/aging/route.ts`, `src/app/api/v1/expenses/account-statements/[contactId]/route.ts`.
- UI: add aging section + CSV export to `src/app/(erp)/expensas/reportes/ReportesExpensasClient.tsx`; new `src/app/(erp)/expensas/cuenta-corriente/page.tsx` + `CuentaCorrienteExpensasClient.tsx` (mirror `compras/cuenta-corriente/CuentaCorrienteProveedorClient.tsx`); link button in `GastosExpensasClient.tsx`.
- Update `src/modules/expenses/index.ts` re-exports. Tests for both services (query/model mocks per existing patterns).

## Workstream 4 — Billing: suspensión en `past_due`

Design decisions:
- Gate **only `past_due`** (`paused`/`cancelled` = follow-up). Exempt real sys-admins including while impersonating.
- **UI hard gate**: redirect all `(erp)` pages to `/suspendido`, exempting `/suspendido` and `/facturacion*` (Gerente can view invoices/pay). Pathname is available in the layout via `headers().get('x-pathname')` (verified — already used by onboarding/module gates).
- **API backstop**: block non-GET/HEAD/OPTIONS with 403 `SUBSCRIPTION_SUSPENDED` at the same 3 api-handler chokepoints (after org resolution, skip real sys-admin). Reads stay open. `/api/v1/billing/*` uses `requireOrgBilling`, not the wrappers → automatically exempt.
- **Caching**: React `cache()` + module-level 60s TTL map keyed by orgId; dunning/reactivation tolerate the lag.

Files:
- New `src/modules/billing/subscription-access.service.ts`: `isOrgSuspended(orgId)` (latest non-deleted `OrgSubscription`, query shape from `org-billing.service.ts`), cached, `clearSubscriptionAccessCache()` for tests.
- New pure `src/lib/suspension-guard.ts`: `SUSPENDIDO_PATH`, `isSuspensionExemptPath()`, `shouldBlockSuspendedApiRequest(method)`.
- Modify `src/app/(erp)/layout.tsx`: add suspension lookup to the existing `Promise.all` (orgId set, not real sys-admin); redirect before the module-access block.
- New `src/app/(erp)/suspendido/page.tsx` + client (mirror `sin-acceso/`): "Tu suscripción está suspendida por falta de pago." + CTA "Ir a Suscripción" when `caps.nav.facturacion`, else "Contactá al administrador…".
- Modify `src/lib/api-handler.ts` (same edit pass as Workstream 1).
- Tests: `suspension-guard.test.ts`, `subscription-access.service.test.ts` (fake timers for TTL).
- Cross-module (billing + auth surface): run `docs/dev/cross-module-checklist.md` before merge.

---

## Verification

- `rtk pnpm check` (typecheck + lint + unit tests); targeted `pnpm exec vitest run src/modules/accounting src/modules/expenses src/modules/billing src/lib`.
- Migration reversibility: `pnpm migrate up` → `down` (accounting_periods drops cleanly) → `up`; `pnpm db:seed-dev`.
- Manual (dev server):
  1. **Contabilidad**: issue an invoice + an expense → `/contabilidad/estado-de-resultados` shows ventas/CMV/gastos/resultado neto consistent with `/contabilidad/balance`; export both CSVs from `/contabilidad/exportacion`, open in Excel (acentos OK).
  2. **Cierre**: close the month → posted entry zeroing results into 3.2.02; estado de resultados for the closed range unchanged (closing entries excluded); overlapping close → error; manual entry posted into closed period → `PERIOD_CLOSED`; late-dated invoice → auto-post clamped to first open day + warn log; reopen → reversal entry.
  3. **Expensas**: expenses with/without proveedor + partial payments → aging buckets match due dates; cuenta corriente running balance = total − pagos; no-contact expense excluded.
  4. **Billing**: set subscription `past_due` (dunning job with overdue invoice) → org user redirected to `/suspendido` everywhere except `/facturacion`; POST returns 403 `SUBSCRIPTION_SUSPENDED`, GET works; register payment → access restored ≤60s. Sys-admin + impersonation unaffected.
  5. **Logging**: `LOG_LEVEL=warn` silences info; object with `password`/`token` → `[Redacted]` in stdout AND PostHog; unhandled route error → structured 500 `INTERNAL`.

## Risks
- Late documents vs cierre → date clamping in `createPostedEntry` (+ UI copy).
- `entry_date` is `DATEONLY`; boundaries are calendar dates (no TZ drift). Existing `issue_date ?? new Date()` server-TZ skew unchanged.
- `postEntry` becomes transactional (guard + update share the transaction) — small, safe refactor.
- PostHog hook bypasses pino redact — fixed explicitly; without it redaction is ineffective for the main prod sink.
- try/catch in wrappers only catches previously-unstructured 500s; no route relies on throwing to Next's default handler.
