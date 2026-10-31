#!/usr/bin/env bash
# Testy smoke testu (T-010; drabina weryfikacji, rung 2): --dry-run wypisuje sprawdzenia, a przeciw
# atrapie aplikacji smoke przechodzi tylko z nagłówkami bezpieczeństwa (SEC2: CSP, HSTS, Referrer-Policy).
# Prawdziwe api z buildem web sprawdza scripts/test/image.test.sh.
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
  bash scripts/smoke.sh "$@" >/dev/null 2>&1 || status=$?
  echo "$status"
}

actual=$(bash scripts/smoke.sh --dry-run staging 2>&1) || true
check "smoke --dry-run staging wypisuje sprawdzenia" "$(cat scripts/test/smoke.dry-run.txt)" "$actual"
check "brak argumentu (exit 2)" "2" "$(exit_status --dry-run)"
check "nieznane środowisko (exit 2)" "2" "$(exit_status --dry-run 'staging; id')"

servers=()
trap 'kill "${servers[@]}" 2>/dev/null || true' EXIT
# start_fixture <tryb>: uruchamia atrapę w tej powłoce (żeby trap ją zatrzymał), adres w $fixture_url.
start_fixture() {
  local port_file
  port_file=$(mktemp)
  node scripts/test/fixtures/web-server.mjs "$1" >"$port_file" 2>/dev/null </dev/null &
  servers+=("$!")
  for _ in $(seq 50); do
    [[ -s "$port_file" ]] && break
    sleep 0.1
  done
  fixture_url="http://127.0.0.1:$(tr -d '[:space:]' <"$port_file")"
}

start_fixture secure
check "przechodzi z nagłówkami bezpieczeństwa (exit 0)" "0" "$(exit_status "$fixture_url")"

start_fixture no-headers
check "nie przechodzi bez nagłówków bezpieczeństwa (exit 1)" "1" "$(exit_status "$fixture_url")"

exit "$failures"
