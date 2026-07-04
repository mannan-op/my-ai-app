FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN CI=true pnpm install

COPY . .

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["pnpm", "dev"]