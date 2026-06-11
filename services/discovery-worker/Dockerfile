FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npx playwright install chromium

CMD ["npm", "run", "start"]
