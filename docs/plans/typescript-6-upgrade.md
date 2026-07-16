# Upgrade TypeScript 5.9 → 6.0 (prep for TS 7)

## Context

TypeScript 7.0 went GA on 2026-07-08 — a Go-native compiler with 8-12x faster typechecks. However, TS 7.0 ships **without the JS compiler API** (`lib/typescript.js`), which this repo's toolchain depends on:

- `next build` type-checking step (Next 16.2.9 requires the `typescript` JS API — breaks Vercel deploys on TS 7; native tsgo integration expected in a later Next release, ~Q3 2026)
- `eslint-config-next` → typescript-eslint (needs the JS API; TS 7 support blocked on the stable API landing in TS 7.1, "several months away")
- Storybook docgen

The sanctioned migration path is **5.x → 6.0 first**: TS 6.0 is the last JS-based release, keeps full tooling compatibility, and aligns defaults/deprecations with 7.0 (deprecated options become hard errors in 7). Decision (user-confirmed): upgrade to TS 6.0 only now; adopt TS 7 in a later PR once Next.js and typescript-eslint support it.

Repo is already well-positioned: `strict: true`, no `baseUrl`, `module: esnext`, `moduleResolution: bundler`, `skipLibCheck: true` all explicitly set; target ES2017 is fine (only es5 was dropped).

## Current state

- Root `package.json`: `typescript: ^5` (installed 5.9.3), plus unused `ts-node: ^10.9.2` (cucumber uses `tsx/cjs`, migrations use `tsx` — nothing references ts-node)
- Workspaces with own TS devDep: `apps/pos` (`^5.0.0`), `packages/shared` (`^5.0.0`), each with `typecheck: tsc --noEmit`
- tsconfigs: root `tsconfig.json`, `packages/shared/tsconfig.json`, `apps/pos/tsconfig{,.node,.web}.json`

## Steps

1. **Copy this plan** to `docs/plans/typescript-6-upgrade.md` (repo convention).

2. **Bump dependencies**
   - Root: `typescript` → `^6.0.0` (latest 6.x); **remove `ts-node`** (unused)
   - `apps/pos/package.json` and `packages/shared/package.json`: `typescript` → `^6.0.0`
   - `pnpm install`

3. **Run the migration scan**: `pnpm exec tsc --ts6-migration` in root, `apps/pos`, and `packages/shared`. Fix everything it reports (removed options, `asserts` import syntax, legacy module usage). Do NOT paper over with `ignoreDeprecations: "6.0"` — the point is TS 7 readiness.

4. **Update tsconfigs for new 6.0 defaults**
   - Root `tsconfig.json`: add `"types": ["node"]` (6.0 default is `[]`; @types/node provides globals like `process`/`Buffer` used across server code; other @types packages resolve via imports and don't need listing)
   - Review `apps/pos/tsconfig*.json` and `packages/shared/tsconfig.json` for the same gap and any deprecated options; keep explicit values where 6.0 changed defaults (`skipLibCheck: true` already explicit at root — mirror where needed)

5. **Fix new type errors**: run `pnpm typecheck` at root and in both workspaces; fix whatever 6.0's stricter checks surface. Scope unknown until run — expect small.

6. **Verify toolchain compatibility**
   - `pnpm lint` — if typescript-eslint (via eslint-config-next 16.2.9) warns about unsupported TS version, bump `eslint-config-next`/`next` patch version to one whose typescript-eslint peer range includes 6.x
   - `pnpm build` — confirms Next's type-check step works against TS 6
   - `pnpm test` — vitest (esbuild-based, low risk)
   - `pnpm build-storybook` — smoke-check docgen

7. **Verify the prod Docker image builds** (see next section): `docker build -f infra/Dockerfile .` locally. No Dockerfile changes expected.

## Docker image & prod release impact

Prod deploys via Docker Swarm: `make prod-release` → `infra/scripts/push-image.sh` builds `infra/Dockerfile` and pushes to ghcr.io; migrations run in-container via `infra/scripts/migrate.sh`.

- **Image build** (`node:24-alpine`): the deps stage runs `pnpm install --frozen-lockfile` (workspace stripped to root, so only the root `typescript` bump matters here) and the builder stage runs `pnpm build` — Next's type-check step exercises TS 6 inside the image. TS 6 is still a pure-JS package: no native binaries, no musl/arch concerns, Node 24 well above its minimum. **No Dockerfile changes needed**, but the lockfile and `package.json` must land in the same commit or `--frozen-lockfile` fails the build.
- **In-container migrations** (`make prod-migrate`): runs `node --import tsx src/db/migrate.ts` — tsx is esbuild-based and never invokes tsc; it only parses the copied `tsconfig.json`, and adding `"types": ["node"]` is harmless to it. No changes needed.
- **Release process unchanged**: this ships as a normal feature PR → `develop` → `/release` → `make prod-release TAG=vX`. Watch the first image build/deploy after merge.
- **TS 7 follow-up flag (not now)**: TS 7 ships platform-specific native binaries — when we adopt it later, verify the alpine/musl (`node:24-alpine`) builder stage is supported or switch the build image to Debian-based. This is the main Docker-specific risk and it belongs to the follow-up PR, not this one.

## Files to modify

- `package.json`, `apps/pos/package.json`, `packages/shared/package.json`, `pnpm-lock.yaml`
- `tsconfig.json`, `packages/shared/tsconfig.json`, `apps/pos/tsconfig.json`, `apps/pos/tsconfig.node.json`, `apps/pos/tsconfig.web.json`
- `docs/plans/typescript-6-upgrade.md` (new)
- Any source files flagged by `--ts6-migration` or new type errors (unknown until run)

## Verification

1. `rtk pnpm check` — typecheck + lint + test all green
2. `pnpm build` — full Next production build (exercises Next's TS API usage)
3. `pnpm --filter @andiko/pos typecheck && pnpm --filter @andiko/shared typecheck`
4. `pnpm build-storybook`
5. `pnpm test:integration` if a local DB is available (cucumber/tsx path)
6. `docker build -f infra/Dockerfile .` — proves the prod image builds with TS 6 (frozen lockfile + `next build` on node:24-alpine)

## Out of scope / follow-up (later PR)

TS 7 adoption. Triggers to revisit:
- Next.js ships native TS 7 / tsgo support for `next build` type-checking (announced for ~Q3 2026)
- TS 7.1 ships the stable API and typescript-eslint supports it

Interim option if typecheck speed hurts before then: dual npm alias (`typescript` = `@typescript/typescript6`, TS 7 under `@typescript/native`) pointing only `pnpm typecheck` at the native binary. Deliberately not doing this now.

## Commit

Single commit, scope `core`: `chore(core): upgrade TypeScript to 6.0` (branch off `develop`, ship via `/ship-feature`).
