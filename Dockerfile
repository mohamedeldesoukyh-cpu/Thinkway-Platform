# Thinkway discovery-worker production image (Railway auto-detects /Dockerfile).
# Build from repo root: docker build -t thinkway-discovery-worker .
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
COPY services/discovery-worker/package.json ./services/discovery-worker/

RUN npm install --omit=dev \
  && cd services/discovery-worker && npm install --omit=dev

COPY . .

RUN cd services/discovery-worker && npx playwright install chromium

ENV NODE_ENV=production
CMD ["npm", "run", "discovery:worker"]
