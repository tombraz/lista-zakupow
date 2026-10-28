#!/usr/bin/env bash
# Emulator Androida dla E2E mobile w CI (T-003, pipeline.md etap 2). Runner Linux z KVM i Android SDK
# (ubuntu-latest ma SDK w $ANDROID_HOME); lokalnie wystarczy emulator z Android Studio.
#   scripts/android-emulator.sh --dry-run   wypisuje kroki bez wykonania
#   scripts/android-emulator.sh             tworzy AVD, uruchamia emulator w tle i czeka na rozruch
set -euo pipefail

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then dry_run=1; fi

API_LEVEL=35
IMAGE="system-images;android-$API_LEVEL;default;x86_64"
AVD=lista-e2e
BOOT_TIMEOUT_S=300

step() { echo "# $1"; }
run() { if ((dry_run)); then echo "$*"; else "$@"; fi; }

step "System image Androida i AVD"
run sdkmanager --install "$IMAGE" platform-tools emulator
if ((dry_run)); then
  echo "avdmanager create avd --force --name $AVD --package $IMAGE --device pixel_6"
else
  echo no | avdmanager create avd --force --name "$AVD" --package "$IMAGE" --device pixel_6
fi

step "Start emulatora bez okna i czekanie na koniec rozruchu"
emulator_args=(-avd "$AVD" -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect)
if ((dry_run)); then
  echo "emulator ${emulator_args[*]}"
else
  nohup emulator "${emulator_args[@]}" >"${RUNNER_TEMP:-/tmp}/emulator.log" 2>&1 &
fi
run adb wait-for-device
if ((dry_run)); then
  echo "adb shell getprop sys.boot_completed"
else
  deadline=$((SECONDS + BOOT_TIMEOUT_S))
  until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    if ((SECONDS > deadline)); then
      echo "Emulator nie wystartował w ${BOOT_TIMEOUT_S} s" >&2
      exit 1
    fi
    sleep 5
  done
fi

step "Bez animacji (stabilne flowy Maestro)"
for setting in window_animation_scale transition_animation_scale animator_duration_scale; do
  run adb shell settings put global "$setting" 0
done
