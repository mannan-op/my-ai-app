FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install

COPY . .

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["pnpm", "dev"]