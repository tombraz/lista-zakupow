#!/usr/bin/env bash
# Test zachowania scripts/android-emulator.sh (T-003, poprawka po przebiegu CI 40734724299, gdzie
# `adb wait-for-device` wisiał ~42 min): gdy emulator padnie albo nie wstanie w czasie, skrypt kończy się
# błędem w limicie czasu i wypisuje koniec logu emulatora. Po przebiegu 40742587020 („Unknown AVD name
# [lista-e2e]”): avdmanager i emulator szukają AVD w tym samym katalogu. Narzędzia SDK to atrapy w PATH.
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
# Wspólny początek atrap emulatora: -accel-check i -list-avds działają zawsze.
emulator_common='if [[ "${1-}" == "-accel-check" ]]; then echo "accel ok"; exit 0; fi
if [[ "${1-}" == "-list-avds" ]]; then echo lista-e2e; exit 0; fi'

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
  "$emulator_common"'
echo "FATAL: atrapa emulatora padła"; exit 1' \
  "FATAL: atrapa emulatora padła"
run_case "emulator wisi: błąd po BOOT_TIMEOUT_S i log emulatora" \
  "$emulator_common"'
echo "emulator: booting forever"; sleep 600' \
  "emulator: booting forever"

# Jak na runnerze GitHub: avdmanager bez ANDROID_AVD_HOME zapisuje AVD gdzie indziej (tu: $ANDROID_USER_HOME/avd),
# a emulator szuka w $ANDROID_AVD_HOME albo $HOME/.android/avd. Skrypt musi wskazać obu ten sam katalog.
avd_case() {
  local name=$1
  fake avdmanager 'cat >/dev/null; dir=${ANDROID_AVD_HOME:-$ANDROID_USER_HOME/avd}; mkdir -p "$dir"; touch "$dir/lista-e2e.ini"'
  fake emulator 'dir=${ANDROID_AVD_HOME:-$HOME/.android/avd}
if [[ "${1-}" == "-accel-check" ]]; then exit 0; fi
if [[ "${1-}" == "-list-avds" ]]; then for f in "$dir"/*.ini; do [[ -e "$f" ]] && basename "$f" .ini; done; exit 0; fi
if [[ -e "$dir/lista-e2e.ini" ]]; then touch "$BOOTED_MARK"; sleep 37; else echo "ERROR | Unknown AVD name [lista-e2e]"; exit 1; fi'
  fake adb 'if [[ "${1-} ${2-} ${3-}" == "shell getprop sys.boot_completed" && -e "$BOOTED_MARK" ]]; then echo 1; fi; exit 0'
  local out status=0
  out=$(env -u ANDROID_AVD_HOME PATH="$work/bin:$PATH" RUNNER_TEMP="$work/tmp" BOOT_TIMEOUT_S=8     HOME="$work/home" ANDROID_USER_HOME="$work/user-home" BOOTED_MARK="$work/booted"     timeout 60 bash scripts/android-emulator.sh 2>&1) || status=$?
  if ((status == 0)); then
    echo "ok   $name"
  else
    echo "FAIL $name (exit $status)"
    printf '%s
' "$out" | tail -n 15
    failures=$((failures + 1))
  fi
  pkill -f "sleep 37" 2>/dev/null || true
}
avd_case "AVD z avdmanager widoczne dla emulatora: rozruch się kończy"

exit "$failures"
