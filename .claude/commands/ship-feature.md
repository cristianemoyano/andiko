# ship-feature

Ship the current feature: quality checks → commit → push directly to `develop`.

## Branching model

```
main         ← versioned releases only (tags + changelog)
develop      ← integration branch — commit and push here directly
feature/*    ← only for large multi-session features or collaboration
```

Push directly to `develop`. Skip feature branches and PRs unless explicitly asked.

---

## Steps

### 1. Identify the feature and context

Summarize what was built in this session in one sentence — this becomes the PR title.
Derive a branch slug: `feature/<kebab-case-description>` (max 5 words).

**Detect context** by running `git diff --name-only origin/develop...HEAD` (or checking unstaged changes if not yet committed). Then classify:

- **POS context**: majority of changes are under `apps/pos/`, `.github/workflows/pos-*.yml`, or `packages/` touched only by the POS
- **ERP context**: majority of changes are under `src/`, `apps/web/`, or migrations
- **Mixed**: changes span both — treat as ERP context but run POS checks too

---

### 2. Ensure you're on develop

```bash
git fetch origin
git checkout develop
git pull origin develop
```

If already on `develop`, continue. Never commit to `main`.

---

### 3. Quality checks — run based on context

#### ERP context

**Verify root scripts exist** (`package.json` at repo root) — add if missing:
- `"lint"` → `"eslint src/"` (not `next lint` — broken in Next.js 16)
- `"typecheck"` → `"tsc --noEmit"`
- `"test"` → `"vitest run --passWithNoTests"`

```bash
pnpm check   # typecheck + lint + test in parallel (preferred)
```

Or individually:

```bash
pnpm typecheck   # run from repo root
pnpm lint        # run from repo root
pnpm test        # run from repo root
```

Fix all errors. No `@ts-ignore` without an inline comment. Never disable lint rules without a reason comment.

**Unit tests** — scan for `*.test.ts` / `*.spec.ts` beside each modified service. Write missing tests for new/modified service functions:
- Framework: Vitest (`describe`, `it`, `expect`, `vi`)
- Mock Sequelize models with `vi.mock`
- Cover: happy path, validation failure, ERP edge cases (zero amounts, duplicate fiscal numbers, negative stock)
- Skip route handlers and React components — services only

#### POS context

```bash
cd apps/pos && pnpm typecheck   # tsc --noEmit in apps/pos
```

The POS has no lint config or test suite — skip `pnpm lint` and `pnpm test`.

Optionally verify the build compiles without errors:
```bash
cd apps/pos && pnpm build
```
(This is slow — only run if you changed main process, preload, or vite config. Skip for renderer-only changes.)

#### Mixed context

Run all ERP checks from root, then run POS typecheck from `apps/pos/`.

---

### 4. Update ROADMAP.md

Read `docs/ROADMAP.md` and update it to reflect what was just built:

- Mark completed tasks as `- [x]` in the corresponding phase.
- If the feature introduced something not listed, add it as a new `- [x]` item under the right phase.
- If the feature revealed work that's still needed, add it as `- [ ]` under the same phase.
- Do not rewrite descriptions or restructure phases — only update checkboxes and add missing items.

Always include `docs/ROADMAP.md` in the commit if it was modified.

---

### 5. Stage files

```bash
git diff --stat        # review what changed
git add <specific files>
```

Never `git add .` blindly. Exclude: `.env*`, debug files, `dist-electron/`, `out/`, `apps/pos/dist/`, unrelated changes.

---

### 6. Commit (Conventional Commits)

Format: `<type>(<scope>): <short description>`

| type | when |
|---|---|
| `feat` | new functionality |
| `fix` | bug fix |
| `refactor` | no behavior change |
| `test` | adding/fixing tests |
| `chore` | tooling, deps, config |
| `docs` | documentation only |

**Scope:**
- ERP modules: `sales`, `inventory`, `purchases`, `contacts`, `accounting`, `auth`
- Cross-cutting / infra: `core`
- Use `core` for POS features, CI/CD, monorepo config, shared packages

Header max 100 characters. Body lines max 100 characters.

```bash
git commit -m "feat(core): add barcode scanner support to POS sale screen"
```

If husky/lint-staged hooks fail → fix the reported issue and retry. Never `--no-verify`.

---

### 7. Push to develop

```bash
git push origin develop
```

---

### 8. Report

Print a one-line summary of what was shipped and the commit hash.

---

## Guardrails

- **Never target `main` in a PR.** Features go to `develop`. Releases go to `main` via `/release`.
- **Never skip failing tests.** Fix the code or the test — never both without understanding why.
- **Never commit secrets, `.env` files, or unintended migration files.**
- **Never commit POS build artifacts** (`dist-electron/`, `out/`, `apps/pos/dist/`).
- If the feature touches financial flows (invoices, payments, stock), flag it explicitly in the PR body.
- If the feature touches POS IPC handlers or SQLite schema, flag it in the PR body.
- **No magic strings or numbers** in ERP code. Status values, document types, tax codes must be constants or enums.
- **Every ERP list endpoint must support pagination.** Use `paginationSchema`, `paginate()`, and `toPaginated()` from `src/lib/pagination.ts`.

---

## ERP — Next.js 16 patterns

Read `node_modules/next/dist/docs/` before touching routing, proxy, or config.

### Proxy (formerly Middleware)
- File is `src/proxy.ts`, not `middleware.ts`.
- Export as `export { auth as proxy }`. Edge runtime — no Node.js native modules.
- Use a separate `auth.config.ts` (Edge-compatible, no DB imports) if auth is needed in proxy.

### Bundler — server-only packages
Add to `next.config.ts`:
```typescript
serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pino', 'pino-pretty']
```

### Server-only imports
Add `import 'server-only'` to any module using pino, Sequelize, or secrets.

### Route groups
- `src/app/(auth)/` → public pages
- `src/app/(erp)/` → protected pages with auth guard in `layout.tsx`

### Scripts
- `pnpm lint` → `eslint src/` (not `next lint`)
- `pnpm migrate` → `tsx --env-file=.env.local src/db/migrate.ts`

---

## POS — Electron patterns

### IPC
- Handlers registered in `src/main/` via `ipcMain.handle`.
- Exposed in `src/preload/index.ts` via `contextBridge.exposeInMainWorld`.
- Types declared in `src/renderer/env.d.ts`.
- Never call Node.js APIs directly from renderer — always go through preload.

### SQLite / Drizzle
- Schema in `src/db/schema.ts`. Always add migrations for schema changes.
- Never use `better-sqlite3` from the renderer process.

### Version
- App version is injected at build-time as `__APP_VERSION__` via `electron.vite.config.ts`.
- Always sourced from `apps/pos/package.json` — bump it there before releasing.

### Release
- Releases are triggered by pushing a `pos/v*` tag to origin.
- Tag format: `pos/v<semver>` (e.g. `pos/v1.0.0`).
- Never tag without first bumping the version in `apps/pos/package.json`.
