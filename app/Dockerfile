# syntax=docker/dockerfile:1

# Production image for the storefront. Built by CI (.github/workflows/deploy.yml)
# and published to ghcr.io; the VPS only ever pulls it. Building here rather than
# on the server matters: `next build` is the one step that would peg a 2-vCPU box.
#
# Build context is `app/`, which is a self-contained pnpm project (it has its own
# lockfile and workspace file) — the repo root is never needed.

# ---------------------------------------------------------------- dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Corepack reads the `packageManager` field, so the pnpm version cannot drift
# from the one the lockfile was written with.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --------------------------------------------------------------------- builder
FROM node:22-alpine AS builder
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the bundles by `next build` — Next.js
# substitutes them textually, in the server output as well as the browser's. They
# therefore CANNOT be supplied at runtime: setting them in docker-compose would
# do nothing. That is why they arrive as build arguments, and why changing the
# domain or rotating the anon key means rebuilding the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---------------------------------------------------------------------- runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# `output: "standalone"` (next.config.ts) traces the modules the server actually
# imports and writes a self-contained tree, so the runtime image carries no
# pnpm store and no devDependencies. Static assets are not part of that trace
# and have to be copied separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# `public/` is the other half of "not part of the trace", and it is served from
# the working directory at runtime rather than resolved as a module. It holds the
# handful of assets that belong to the app rather than to the catalogue — the
# catalogue's own images live in the `media` bucket — and without this line they
# are a 404 in production and nowhere else.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
