FROM node:18-alpine AS base

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output for smaller image)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache python3 py3-pip
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build (smaller than full node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/scripts ./scripts

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

# DB path inside app (Render free has no persistent disk — data resets on redeploy)
ENV DATABASE_URL=file:/app/data/sales-engine.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Run migrations then start standalone server
CMD npx prisma migrate deploy && node server.js
