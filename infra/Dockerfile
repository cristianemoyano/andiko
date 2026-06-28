# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches
# Web app only — exclude POS workspace packages (native deps like better-sqlite3).
RUN printf 'packages:\n  - .\n' > pnpm-workspace.yaml \
  && pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders for Zod validation during `next build` — runtime uses Swarm secrets.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Manual migration runs (make prod-migrate) — seed migrations import src/modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/modules ./src/modules
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/infra/docker-entrypoint.sh ./infra/docker-entrypoint.sh

RUN chmod +x ./infra/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/infra/docker-entrypoint.sh"]
CMD ["node", "server.js"]
