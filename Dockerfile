FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY server ./server

RUN npm run build
RUN npm run build:server

FROM node:26-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 4000
CMD ["node", "dist-server/index.js"]
