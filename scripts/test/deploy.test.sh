#!/usr/bin/env bash
# Testy skryptu wdrożenia (T-010; drabina weryfikacji, rung 2): --dry-run wypisuje komendy flyctl,
# niepoprawne argumenty kończą się błędem przed jakąkolwiek komendą.
set -euo pipefail
cd "$(dirname "$0")/../.."

failures=0
check() {
  local name=$1 expected=$2 actual=$3
  if [[ "$expected" == "$actual" ]]; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    diff <(printf '%s\n' "$expected") <(printf '%s\n' "$actual") || true
    failures=$((failures + 1))
  fi
}

exit_status() {
  local status=0
  bash scripts/deploy.sh "$@" >/dev/null 2>&1 || status=$?
  echo "$status"
}

actual=$(bash scripts/deploy.sh --dry-run staging 0123abc 2>&1) || true
check "deploy --dry-run staging <sha> wypisuje komendy" "$(cat scripts/test/deploy.dry-run.txt)" "$actual"

check "brak argumentów (exit 2)" "2" "$(exit_status --dry-run)"
check "brak sha (exit 2)" "2" "$(exit_status --dry-run staging)"
check "niepoprawne środowisko (exit 2)" "2" "$(exit_status --dry-run 'staging; rm -rf /' 0123abc)"
check "środowisko bez konfiguracji Fly (exit 2)" "2" "$(exit_status --dry-run qa 0123abc)"
check "niepoprawny sha (exit 2)" "2" "$(exit_status --dry-run staging 'main;id')"

# AC5: konfiguracja Fly staging (porównanie kluczy) i pula połączeń (Neon usypia, deployment.md „Ryzyka”).
toml_value() { sed -nE "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*(.*)$/\1/p" "$2" | head -1; }
config=apps/api/fly.staging.toml
check "fly.staging: region fra" '"fra"' "$(toml_value primary_region "$config")"
check "fly.staging: auto-stop włączony" '"stop"' "$(toml_value auto_stop_machines "$config")"
check "fly.staging: auto-start włączony" "true" "$(toml_value auto_start_machines "$config")"
check "fly.staging: bez stale działającej maszyny" "0" "$(toml_value min_machines_running "$config")"
check "fly.staging: force_https" "true" "$(toml_value force_https "$config")"
check "fly.staging: healthcheck na /health" '"/health"' "$(toml_value path "$config")"
check "fly.staging: migracje jako release_command" '"node apps/api/dist/db/migrate.js"' \
  "$(toml_value release_command "$config")"
check "fly.staging: APP_ORIGIN = adres staging" '"https://lista-staging.fly.dev"' \
  "$(toml_value APP_ORIGIN "$config")"
idle_ms=$(sed -nE 's/^const IDLE_TIMEOUT_MS = ([0-9_]+);.*/\1/p' apps/api/src/db/pool.ts | tr -d _)
if ((${idle_ms:-999999} <= 60000)); then idle_ok=tak; else idle_ok="nie (${idle_ms:-brak})"; fi
check "pula zamyka bezczynne połączenia ≤ 60 s" "tak" "$idle_ok"

exit "$failures"
