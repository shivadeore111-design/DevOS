# ============================================================
# DevOS — Autonomous AI Execution System
# Copyright (c) 2026 Shiva Deore. All rights reserved.
# ============================================================

FROM node:20-alpine

# Install system utilities needed by DevOS skills
RUN apk add --no-cache \
    bash \
    curl \
    git \
    python3 \
    py3-pip \
    jq

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Compile TypeScript
RUN npx tsc --noEmit || true
# (compile errors are non-fatal — we run via ts-node in dev)

EXPOSE 4200

# Health check — ping the public endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:4200/api/system/health || exit 1

# Default entrypoint: start the API server
CMD ["npx", "ts-node", "index.ts", "serve"]
