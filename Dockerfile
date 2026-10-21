FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@12.10.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-only credentials and database never enter the runtime image or live data.
RUN PAYLOAD_SECRET="$(node -p "require('crypto').randomBytes(48).toString('hex')")" \
    CMS_ADMIN_EMAIL=build@ohana.invalid \
    CMS_ADMIN_PASSWORD="$(node -p "require('crypto').randomBytes(24).toString('hex')")" \
    APP_URL=https://www.ohana-barbershop.com \
    OWNER_APP_URL=https://www.owner.ohana-barbershop.com \
    DATABASE_URL=file:/tmp/ohana-build.db SMS_PROVIDER=twilio pnpm build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.10.1
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
