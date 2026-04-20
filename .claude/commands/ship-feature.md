# ship-feature

Ship the current feature: branch → lint → typecheck → test → commit → push → PR into `develop`.

## Branching model

```
main         ← versioned releases only (tags + changelog)
develop      ← integration branch, always deployable
feature/*    ← one branch per feature, branched off develop
```

Never push directly to `main` or `develop`.

---

## Steps

### 1. Identify the feature
Summarize what was built in this session in one sentence — this becomes the PR title.  
Derive a branch slug: `feature/<kebab-case-description>` (max 5 words).

### 2. Create or verify the feature branch
```bash
# Must branch off develop, not main
git fetch origin
git checkout -b feature/<slug> origin/develop
```
If already on a `feature/*` branch, continue. If on `main` or `develop`, create the branch now.

### 3. Verify scripts exist in `package.json`
Required scripts — add them if missing:
- `"lint"` → `"eslint src/"` (not `next lint` — broken in Next.js 16)
- `"typecheck"` → `"tsc --noEmit"`
- `"test"` → `"vitest run --passWithNoTests"`

Package manager: **pnpm**. Never `npm run` or `yarn`.

### 4. Typecheck
```bash
pnpm typecheck
```
Fix all errors. No `@ts-ignore` without an inline comment explaining the exception.

### 5. Lint
```bash
pnpm lint
```
Fix all errors. Never disable a lint rule without an inline `// eslint-disable-next-line` comment with a reason.

### 6. Unit tests

#### 6a. Check coverage of changed files
Scan for test files (`*.test.ts`, `*.spec.ts`) alongside each modified service or utility.

#### 6b. Write missing tests
If a service function was created or modified and has no test coverage, write it now:
- Framework: **Vitest** (`describe`, `it`, `expect`, `vi`)
- File location: beside the source (`foo.service.test.ts` next to `foo.service.ts`)
- Mock Sequelize models with `vi.mock`
- Cover: happy path, validation failure, ERP edge cases (zero amounts, duplicate fiscal numbers, negative stock)
- Skip route handlers and React components — services only

#### 6c. Run tests
```bash
pnpm test
```
All must pass. Fix failures before continuing.

### 7. Update ROADMAP.md

Read `docs/ROADMAP.md` and update it to reflect what was just built:

- Mark completed tasks as `- [x]` in the corresponding phase.
- If the feature introduced something not listed, add it as a new `- [x]` item under the right phase.
- If the feature revealed work that's still needed, add it as `- [ ]` under the same phase.
- Do not rewrite descriptions or restructure phases — only update checkboxes and add missing items.

Always include `docs/ROADMAP.md` in the commit if it was modified.

### 8. Stage files
```bash
git diff --stat        # review what changed
git add <specific files>
```
Never `git add .` blindly. Exclude: `.env*`, debug files, unrelated changes.

### 9. Commit (Conventional Commits)

Format: `<type>(<scope>): <short description>`

| type | when |
|---|---|
| `feat` | new functionality |
| `fix` | bug fix |
| `refactor` | no behavior change |
| `test` | adding/fixing tests |
| `chore` | tooling, deps, config |
| `docs` | documentation only |

Scope = ERP module: `sales`, `inventory`, `purchases`, `contacts`, `accounting`, `auth`, `core`

```bash
git commit -m "feat(sales): add invoice creation with IVA 21% breakdown"
```

If husky/lint-staged hooks fail → fix the reported issue and retry. Never `--no-verify`.

### 10. Push
```bash
git push -u origin feature/<slug>
```

### 11. Open PR → develop
```bash
gh pr create \
  --base develop \
  --title "feat(<scope>): <description>" \
  --body "$(cat <<'EOF'
## What
<one paragraph describing the feature and its business purpose>

## Changes
- <bullet per significant file or behavior change>

## Testing
- [ ] Unit tests written and passing
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean

## ERP / Fiscal notes
<AFIP implications, tax fields, fiscal document changes — omit if none>
EOF
)"
```

### 12. Report
Print the PR URL and a one-line summary of what was shipped.

---

## Guardrails

- **Never target `main` in a PR.** Features go to `develop`. Releases go to `main` via `/release`.
- **Never skip failing tests.** Fix the code or the test — never both without understanding why.
- **Never commit secrets, `.env` files, or unintended migration files.**
- If the feature touches financial flows (invoices, payments, stock), flag it explicitly in the PR body.
- **No magic strings or numbers.** Status values, document types, tax codes, ENUMs, and other fixed domain values must be defined as TypeScript constants or enum types — never hardcoded inline. Scan the diff for string literals that represent domain concepts and extract them before committing.
- **Every list endpoint must support pagination.** Any `GET` route that returns an array of resources must accept `page` and `limit` query params and return `{ data, total, page, limit, pages }`. Use `paginationSchema`, `paginate()`, and `toPaginated()` from `src/lib/pagination.ts` — never roll your own offset logic or response shape.

---

## Next.js 16 — Patrones obligatorios

Leer `node_modules/next/dist/docs/` antes de escribir código que toque routing, proxy o config.

### Proxy (antes Middleware)
- El archivo se llama `src/proxy.ts`, no `middleware.ts`.
- Exportar como `export { auth as proxy }` o `export default function proxy()`. No `export default auth` con nombre distinto.
- El proxy corre en **Edge runtime**: sin Node.js nativo (`pg`, `sequelize`, `bcryptjs`, `pino`).
- Si necesitás auth en el proxy, usá un `auth.config.ts` Edge-compatible (sin imports de DB) separado del `auth.ts` completo.

### Bundler — paquetes server-only
Agregar a `next.config.ts` cualquier paquete Node.js que no debe bundlearse para cliente:
```typescript
serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pino', 'pino-pretty']
```
Si ves `"Please install pg package manually"` en el browser → falta este config.

### Server-only imports
Agregar `import 'server-only'` al tope de cualquier módulo que use pino, Sequelize, o secretos,
para que Next.js falle en build si se importa desde un Client Component.

### Route groups
- `src/app/(auth)/` → páginas públicas (login, etc.)
- `src/app/(erp)/` → páginas protegidas, con auth guard en `layout.tsx`
- Los route groups no afectan la URL.

### Scripts
- `pnpm lint` → `eslint src/` (no `next lint`, roto en v16)
- `pnpm migrate` → `tsx --env-file=.env.local src/db/migrate.ts` (tsx no carga `.env.local` solo)
