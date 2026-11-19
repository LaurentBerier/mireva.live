FROM node:22.23.4-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY deploy/corresponding-source.tar.gz /tmp/corresponding-source.tar.gz
RUN tar -xzf /tmp/corresponding-source.tar.gz -C /app && mkdir -p deploy && cp /tmp/corresponding-source.tar.gz deploy/corresponding-source.tar.gz
RUN pnpm install --frozen-lockfile
RUN NODE_OPTIONS=--max-old-space-size=6144 pnpm run agency:build:services
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "scripts/agency-run-service.cjs", "backend"]
