#!/usr/bin/env bash
# Smoke test wdrożonej aplikacji (T-010; pipeline.md, etapy 6 i 11): /health, /health/ready (z bazą),
# strona web oraz nagłówki bezpieczeństwa (SEC2: CSP, HSTS, Referrer-Policy; TH-15, TH-24). Dla https://
# także przekierowanie z http://. Ponawia żądania, bo maszyna staging i baza Neon wstają po uśpieniu.
#   scripts/smoke.sh --dry-run <środowisko|adres>   wypisuje sprawdzenia bez wykonania
#   scripts/smoke.sh <środowisko|adres>             wykonuje (staging, production albo http(s)://host[:port])
set -euo pipefail

usage() {
  echo "Użycie: scripts/smoke.sh [--dry-run] <staging|production|http(s)://host[:port]>" >&2
  exit 2
}

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then
  dry_run=1
  shift
fi
(($# == 1)) || usage
case "$1" in
  staging) base_url=https://lista-staging.fly.dev ;;
  production) base_url=https://lista-prod.fly.dev ;;
  *)
    if [[ ! "$1" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
      echo "Nieznane środowisko lub adres: $1" >&2
      usage
    fi
    base_url=$1
    ;;
esac

CURL=(curl --silent --show-error --max-time 30)
RETRY=(--retry 10 --retry-delay 3 --retry-all-errors)
SECURITY_HEADERS="content-security-policy, strict-transport-security, referrer-policy: no-referrer"
failures=0

step() { echo "# $1"; }
fail() {
  echo "FAIL: $1" >&2
  failures=$((failures + 1))
}

# fetch <ścieżka>: nagłówki i treść odpowiedzi 2xx w $response (po ponowieniach); błąd = porażka testu.
fetch() {
  local command=("${CURL[@]}" "${RETRY[@]}" --fail --dump-header - "$base_url$1")
  if ((dry_run)); then
    echo "${command[*]}"
    return
  fi
  if ! response=$("${command[@]}"); then
    fail "GET $1 nie zwrócił 2xx"
    response=""
  fi
}

expect_header() {
  local path=$1 pattern=$2
  grep -Eiq "^$pattern" <<<"$response" || fail "GET $path: brak nagłówka ${pattern%%:*}"
}

expect_security_headers() {
  expect_header "$1" 'content-security-policy: .+'
  expect_header "$1" 'strict-transport-security: .*max-age=[1-9]'
  expect_header "$1" 'referrer-policy: no-referrer[[:space:]]*$'
}

expect_web_page() {
  grep -q '<div id="root">' <<<"$response" || fail "GET /: brak strony web (<div id=\"root\">)"
  expect_security_headers /
}

check() {
  local description=$1
  shift
  if ((dry_run)); then
    echo "# sprawdź: $description"
  else
    "$@"
  fi
}

step "Smoke test $base_url"
fetch /health
check "200, nagłówki $SECURITY_HEADERS" expect_security_headers /health

fetch /health/ready
check "200 (API połączone z bazą)" true

fetch /
check "200, strona web (<div id=\"root\">), nagłówki $SECURITY_HEADERS" expect_web_page

if [[ "$base_url" == https://* ]]; then
  http_url="http://${base_url#https://}/health"
  redirect=("${CURL[@]}" --dump-header - "$http_url")
  if ((dry_run)); then
    echo "${redirect[*]}"
  elif ! "${redirect[@]}" | grep -Eiq "^location: ${base_url//./\\.}/health[[:space:]]*$"; then
    fail "GET $http_url nie przekierowuje na $base_url/health"
  fi
  check "przekierowanie na $base_url/health" true
fi

if ((failures)); then
  echo "Smoke test: $failures porażek" >&2
  exit 1
fi
if ((!dry_run)); then echo "Smoke test: OK"; fi
