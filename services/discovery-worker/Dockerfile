# Compatibility path — prefer repo-root Dockerfile (Railway auto-detects it).
# From repo root:
#   docker build -t thinkway-discovery-worker .
#   docker build -f services/discovery-worker/Dockerfile .
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY services/discovery-worker/package.json services/discovery-worker/package-lock.json ./services/discovery-worker/

RUN npm ci --omit=dev \
  && cd services/discovery-worker && npm ci --omit=dev

COPY . .

# Install the OS dependencies for the exact locked Playwright version.
# Launch it during the build so an unusable fallback cannot be deployed.
RUN cd services/discovery-worker && npx playwright install --with-deps chromium \
  && node browser-smoke.mjs

ENV NODE_ENV=production
CMD ["npm", "run", "discovery:worker"]
