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

RUN apt-get update && apt-get install -y openssl python3 python3-venv python3-pip git --no-install-recommends && rm -rf /var/lib/apt/lists/*
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

# Set up Python venv with twikit + instagrapi
RUN python3 -m venv /app/scripts/venv && /app/scripts/venv/bin/pip install --no-cache-dir -r /app/scripts/requirements.txt

# Create data directory and home directory for nextjs user (npm cache needs it)
RUN mkdir -p /app/data /home/nextjs && chown -R nextjs:nodejs /app/data /home/nextjs

USER nextjs

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Start standalone server (DB schema managed externally via Supabase)
CMD node server.js
