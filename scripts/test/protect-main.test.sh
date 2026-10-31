#!/usr/bin/env bash
# Test skryptu ochrony repo (drabina weryfikacji, rung 2): tryb --dry-run wypisuje komendy gh.
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

actual=$(bash scripts/protect-main.sh --dry-run tombraz/lista-zakupow 2>&1) || true
check "dry-run wypisuje komendy gh" "$(cat scripts/test/protect-main.dry-run.txt)" "$actual"

status=0
bash scripts/protect-main.sh --dry-run 'zla nazwa; rm -rf /' >/dev/null 2>&1 || status=$?
check "odrzuca niepoprawną nazwę repozytorium (exit 2)" "2" "$status"

exit "$failures"
