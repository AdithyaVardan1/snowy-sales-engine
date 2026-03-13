FROM node:18-slim AS base

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
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
FROM node:18-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl python3 --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Copy standalone build (smaller than full node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/scripts ./scripts

# Create data directory and home directory for nextjs user (npm cache needs it)
RUN mkdir -p /app/data /home/nextjs && chown -R nextjs:nodejs /app/data /home/nextjs

USER nextjs

# DB path inside app (Render free has no persistent disk — data resets on redeploy)
ENV DATABASE_URL=file:/app/data/sales-engine.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Create/sync DB tables then start standalone server
CMD node ./node_modules/prisma/build/index.js db push --skip-generate && node server.js
