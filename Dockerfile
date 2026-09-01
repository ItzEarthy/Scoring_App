# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

# ---------------------------------------------------------------------------
# deps: install dependencies (cached separately from source changes)
# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder: generate the Prisma client and produce the Next.js standalone build.
# Also doubles as the image used to run `prisma migrate deploy` (it has the
# full node_modules, including the Prisma CLI, and the migrations folder).
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
# Prisma's config loader requires DATABASE_URL to be set even for `generate`,
# though no connection is actually made. The real value is supplied at
# runtime by docker-compose.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so the
# browser's websocket URL for the realtime relay (realtime/) must be known
# here rather than read at container start.
ARG NEXT_PUBLIC_WS_URL="ws://localhost:3001"
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# runner: minimal production image running the standalone Next.js server
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
