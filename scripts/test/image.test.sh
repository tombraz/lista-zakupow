#!/usr/bin/env bash
# Testy skryptu obrazu (T-010; drabina weryfikacji, rung 2): --dry-run wypisuje komendy docker / Trivy,
# niepoprawne argumenty kończą się błędem. Uruchomienie obrazu sprawdza scripts/test/image-run.test.sh.
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
  bash scripts/image.sh "$@" >/dev/null 2>&1 || status=$?
  echo "$status"
}

actual=$(
  for action in build scan push; do bash scripts/image.sh --dry-run "$action" 0123abc 2>&1 || true; done
)
check "image --dry-run build / scan / push wypisuje komendy" "$(cat scripts/test/image.dry-run.txt)" "$actual"
check "brak argumentów (exit 2)" "2" "$(exit_status --dry-run)"
check "nieznana akcja (exit 2)" "2" "$(exit_status --dry-run deploy 0123abc)"
check "niepoprawny sha (exit 2)" "2" "$(exit_status --dry-run build 'x;id')"

exit "$failures"
