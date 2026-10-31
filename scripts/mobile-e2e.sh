#!/usr/bin/env bash
# E2E mobile (T-003, AC2): lokalne api z bazą z docker-compose.yml, build wydania aplikacji na
# uruchomiony emulator Androida, flowy Maestro z apps/mobile/e2e/.
#   scripts/mobile-e2e.sh --dry-run   wypisuje kroki bez wykonania
#   scripts/mobile-e2e.sh             wykonuje; wymaga Dockera, emulatora (adb), JDK 17+ i maestro w PATH
set -euo pipefail
cd "$(dirname "$0")/.."

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then dry_run=1; fi

API_ORIGIN=http://127.0.0.1:3000
# Emulator widzi localhost hosta pod 10.0.2.2 (layers/mobile.md, „Pułapki”).
export API_URL=http://10.0.2.2:3000
export DATABASE_URL=${DATABASE_URL:-postgres://lista:lista@localhost:5442/lista}
export APP_ORIGIN=${APP_ORIGIN:-$API_ORIGIN}
RESULTS=apps/mobile/e2e/results

step() { echo "# $1"; }
run() { if ((dry_run)); then echo "$*"; else "$@"; fi; }

step "Baza i migracje"
run pnpm services:up
run pnpm --filter @lista/api db:migrate

step "Lokalne api ($API_ORIGIN; emulator widzi je pod 10.0.2.2)"
if ((dry_run)); then
  echo "pnpm --filter @lista/api exec tsx src/server.ts"
  echo "curl --silent --fail $API_ORIGIN/health"
else
  # Sekret jednorazowy dla tego przebiegu, nigdzie niezapisywany.
  BETTER_AUTH_SECRET=$(openssl rand -hex 32) pnpm --filter @lista/api exec tsx src/server.ts \
    >"${RUNNER_TEMP:-/tmp}/mobile-e2e-api.log" 2>&1 &
  api_pid=$!
  trap 'kill "$api_pid" 2>/dev/null || true' EXIT
  for _ in $(seq 60); do
    if curl --silent --fail "$API_ORIGIN/health" >/dev/null; then break; fi
    sleep 1
  done
  curl --silent --fail "$API_ORIGIN/health" >/dev/null
fi

step "Build wydania z API_URL=$API_URL, instalacja i start na emulatorze"
run pnpm --filter @lista/mobile exec expo run:android --variant release --no-bundler

step "Flowy Maestro"
run mkdir -p "$RESULTS"
run maestro test --format junit --output "$RESULTS/report.xml" apps/mobile/e2e
