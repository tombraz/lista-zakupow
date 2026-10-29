#!/usr/bin/env bash
# SEC4 (T-010): uprawnienia i sekrety w .github/workflows/deploy.yml — packages: write tylko w jobie
# image, sekrety Fly tylko w jobie ze środowiskiem staging, concurrency bez anulowania wdrożeń w toku.
#   scripts/test/deploy-workflow.test.sh [plik]   domyślnie .github/workflows/deploy.yml
set -euo pipefail
cd "$(dirname "$0")/../.."
workflow=${1:-.github/workflows/deploy.yml}

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

# job <nazwa>: treść joba (wcięcie 2 spacje pod jobs:) bez komentarzy.
job() {
  awk -v name="$1" '
    /^jobs:/ { in_jobs = 1; next }
    in_jobs && /^  [A-Za-z0-9_-]+:/ { current = $1; sub(":", "", current) }
    in_jobs && current == name && $0 !~ /^[[:space:]]*#/ { print }
  ' "$workflow"
}
jobs=$(awk '/^jobs:/ { in_jobs = 1; next } in_jobs && /^  [A-Za-z0-9_-]+:/ { sub(":", "", $1); print $1 }' "$workflow")
count() { grep -c "$@" || true; }
# Blok najwyższego poziomu (np. permissions:) jako jedna linia „klucz|wartości”.
top_level() { awk -v key="$1:" '$0 == key { in_block = 1; print; next } in_block && /^[^ ]/ { exit } in_block && NF { print }' "$workflow" | paste -sd'|'; }

check "domyślne uprawnienia: contents: read" "permissions:|  contents: read" \
  "$(top_level permissions)"
for name in $jobs; do
  expected=0
  [[ "$name" == image ]] && expected=1
  check "packages: write w jobie $name" "$expected" "$(job "$name" | count 'packages: write')"
  if [[ "$name" != image ]]; then
    check "secrets.GITHUB_TOKEN nie w jobie $name" "0" "$(job "$name" | count 'secrets.GITHUB_TOKEN')"
  fi
  if [[ "$name" != staging ]]; then
    check "sekrety środowiska nie w jobie $name" "0" \
      "$(job "$name" | grep -- 'secrets\.' | count -v -e 'secrets.GITHUB_TOKEN')"
  fi
done
check "job staging w środowisku staging" "1" "$(job staging | count '      name: staging')"
check "concurrency staging bez anulowania w toku" "1" "$(job staging | count 'cancel-in-progress: false')"
check "concurrency staging: grupa per środowisko" "1" "$(job staging | count 'group: deploy-staging')"

exit "$failures"
