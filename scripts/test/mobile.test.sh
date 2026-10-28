#!/usr/bin/env bash
# Testy skryptów mobile (T-003; drabina weryfikacji, rung 2): tryb --dry-run wypisuje kroki.
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

for script in android-emulator mobile-e2e ios-simulator-build; do
  actual=$(bash "scripts/$script.sh" --dry-run 2>&1) || true
  check "$script --dry-run wypisuje kroki" "$(cat "scripts/test/$script.dry-run.txt" 2>/dev/null)" "$actual"
done

exit "$failures"
