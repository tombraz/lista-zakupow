#!/usr/bin/env bash
# Testy scripts/workflow-check.mjs (T-013, AC2): workflow ze znacznikiem TYMCZASOWE jest odrzucany,
# bieżące .github/workflows/ przechodzi.
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

status_of() {
  local status=0
  "$@" >/dev/null 2>&1 || status=$?
  echo "$status"
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp .github/workflows/*.yml "$tmp/"
sed 's/^on:$/on:\n  # TYMCZASOWE: przykład z przeglądu E-01/' .github/workflows/deploy.yml >"$tmp/deploy.yml"

check "bieżące .github/workflows przechodzą" "0" "$(status_of node scripts/workflow-check.mjs)"
check "kopia ze znacznikiem TYMCZASOWE odrzucona" "1" "$(status_of node scripts/workflow-check.mjs "$tmp")"
check "komunikat wskazuje plik i linię" "1" \
  "$(node scripts/workflow-check.mjs "$tmp" 2>&1 | grep -c 'deploy.yml:[0-9]*: TYMCZASOWE' || true)"

exit "$failures"
