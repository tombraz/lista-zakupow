#!/usr/bin/env bash
# Testy skanu ZAP baseline (T-010, AC4; rung 2): --dry-run wypisuje komendy, produkcja jest odrzucana
# (skanujemy tylko staging), a raport z alertem wysokim kończy skan porażką.
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

actual=$(bash scripts/zap.sh --dry-run staging 2>&1) || true
# Ścieżka repozytorium zależy od maszyny (Windows: C:/...).
repo=$PWD
if command -v cygpath >/dev/null; then repo=$(cygpath -m "$repo"); fi
actual=${actual//"$repo"/<repo>}
check "zap --dry-run staging wypisuje komendy" "$(cat scripts/test/zap.dry-run.txt)" "$actual"
check "brak argumentu (exit 2)" "2" "$(status_of bash scripts/zap.sh --dry-run)"
check "produkcja odrzucona (exit 2)" "2" "$(status_of bash scripts/zap.sh --dry-run production)"

fixtures=scripts/test/fixtures
check "raport bez alertów wysokich przechodzi" "0" \
  "$(status_of node scripts/zap-high-alerts.mjs "$fixtures/zap-report-medium.json")"
check "raport z alertem wysokim nie przechodzi" "1" \
  "$(status_of node scripts/zap-high-alerts.mjs "$fixtures/zap-report-high.json")"

# AC4: brak nagłówków CSP i HSTS (oraz ochrony przed osadzaniem) to reguły FAIL.
for rule in 10038 10035 10020 10021; do
  check "reguła $rule ma poziom FAIL" "FAIL" "$(awk -F'\t' -v id="$rule" '$1 == id { print $2 }' .zap/rules.tsv)"
done

exit "$failures"
