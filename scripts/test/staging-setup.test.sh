#!/usr/bin/env bash
# Testy skryptu przygotowania staging (T-010; rung 2): --dry-run wypisuje kroki właściciela bez wartości
# sekretów; DATABASE_URL bez sslmode=require albo spoza Frankfurtu jest odrzucany (SEC3, TH-07).
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

neon='postgresql://lista:tajne-haslo@ep-test-123.eu-central-1.aws.neon.tech/lista?sslmode=require'
status_with_url() {
  local status=0
  STAGING_DATABASE_URL=$1 bash scripts/staging-setup.sh --dry-run tombraz/lista-zakupow >/dev/null 2>&1 || status=$?
  echo "$status"
}

actual=$(STAGING_DATABASE_URL=$neon bash scripts/staging-setup.sh --dry-run tombraz/lista-zakupow 2>&1) || true
check "dry-run wypisuje kroki" "$(cat scripts/test/staging-setup.dry-run.txt)" "$actual"
check "dry-run nie wypisuje hasła bazy" "0" "$(grep -c 'tajne-haslo' <<<"$actual" || true)"
check "brak STAGING_DATABASE_URL (exit 2)" "2" "$(status_with_url '')"
check "DATABASE_URL bez sslmode=require (exit 2)" "2" "$(status_with_url "${neon%%\?*}")"
check "DATABASE_URL spoza Frankfurtu (exit 2)" "2" "$(status_with_url "${neon/eu-central-1/us-east-2}")"

exit "$failures"
