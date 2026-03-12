# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies needed for tsc)
COPY package*.json ./
RUN npm ci

# Compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy skill descriptor alongside the server
COPY SKILL.md ./SKILL.md

# Volume for local-path scans:
#   docker run -i --rm -v /your/project:/workspace a11y-static-scanner
#   → pass local_path="/workspace" to analyze_local_path
VOLUME ["/workspace"]

# MCP servers communicate over stdio — no port needed.
# Run with:  docker run -i --rm a11y-static-scanner
ENTRYPOINT ["node", "dist/index.js"]
