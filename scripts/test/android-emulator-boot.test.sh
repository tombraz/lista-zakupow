#!/usr/bin/env bash
# Test zachowania scripts/android-emulator.sh (T-003, poprawka po przebiegu CI 40734724299, gdzie
# `adb wait-for-device` wisiał ~42 min): gdy emulator padnie albo nie wstanie w czasie, skrypt kończy się
# błędem w limicie czasu i wypisuje koniec logu emulatora. Narzędzia SDK są podstawione atrapami w PATH.
set -euo pipefail
cd "$(dirname "$0")/../.."

failures=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/tmp"

fake() { printf '#!/usr/bin/env bash\n%s\n' "$2" >"$work/bin/$1"; chmod +x "$work/bin/$1"; }
fake sdkmanager 'exit 0'
fake avdmanager 'cat >/dev/null; exit 0'
fake adb 'if [[ "$1" == "wait-for-device" ]]; then sleep 600; fi; echo ""'

run_case() {
  local name=$1 emulator_body=$2 expected_text=$3
  fake emulator "$emulator_body"
  local out status=0
  out=$(PATH="$work/bin:$PATH" RUNNER_TEMP="$work/tmp" BOOT_TIMEOUT_S=4 \
    timeout 60 bash scripts/android-emulator.sh 2>&1) || status=$?
  if ((status != 0 && status != 124)) && [[ "$out" == *"$expected_text"* ]]; then
    echo "ok   $name"
  else
    echo "FAIL $name (exit $status)"
    printf '%s\n' "$out" | tail -n 15
    failures=$((failures + 1))
  fi
}

run_case "emulator padł: błąd od razu i log emulatora" \
  'if [[ "${1-}" == "-accel-check" ]]; then echo "accel ok"; exit 0; fi; echo "FATAL: atrapa emulatora padła"; exit 1' \
  "FATAL: atrapa emulatora padła"
run_case "emulator wisi: błąd po BOOT_TIMEOUT_S i log emulatora" \
  'if [[ "${1-}" == "-accel-check" ]]; then echo "accel ok"; exit 0; fi; echo "emulator: booting forever"; sleep 600' \
  "emulator: booting forever"

exit "$failures"
