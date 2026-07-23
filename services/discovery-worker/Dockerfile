# Build from repo root:
#   docker build -f services/discovery-worker/Dockerfile .
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY services/discovery-worker/package.json ./services/discovery-worker/

RUN npm install --omit=dev \
  && cd services/discovery-worker && npm install --omit=dev

COPY . .

RUN cd services/discovery-worker && npx playwright install chromium

CMD ["npm", "run", "discovery:worker"]
