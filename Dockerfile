# Jeden obraz na commit main (T-010; pipeline.md, etap 4; ADR 0006): Fastify serwuje API i zbudowany
# apps/web/dist pod jednym originem. Bez sekretów w obrazie: konfiguracja z sekretów i [env] Fly.
# Wersja Node zgodna z .nvmrc / engines; tag i digest przypięte (TH-22). Obraz wpisany dosłownie w obu FROM
# (bez ARG): Dependabot (ekosystem docker, T-122) aktualizuje tylko dosłowne FROM, oba naraz.

FROM node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d AS build
WORKDIR /repo
# pnpm w wersji z packageManager w package.json.
RUN npm install --global --no-fund --no-audit pnpm@12.11.2
COPY . .
# Tylko api, web i ich pakiety workspace (mobile poza obrazem).
RUN pnpm install --frozen-lockfile --filter @lista/api... --filter @lista/web... --filter lista-zakupow \
  && pnpm build \
  && pnpm --filter @lista/api deploy --prod /out

FROM node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d
ENV NODE_ENV=production
# npm i corepack nie są potrzebne w czasie działania, a ich zależności mają własne podatności (Trivy).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build /out/package.json apps/api/package.json
COPY --from=build /out/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/drizzle apps/api/drizzle
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/web/dist apps/web/dist
USER node
EXPOSE 8080
# Fly: HOST=0.0.0.0, PORT=8080 w [env]; release_command: node apps/api/dist/db/migrate.js.
ENV HOST=0.0.0.0 PORT=8080
CMD ["node", "apps/api/dist/server.js"]
