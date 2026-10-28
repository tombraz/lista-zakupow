#!/usr/bin/env bash
# Build iOS na symulator w CI (T-003, pipeline.md etap 7, ADR 0008: bez dystrybucji iOS).
# Wymaga macOS z Xcode i CocoaPods (runner macos-latest).
#   scripts/ios-simulator-build.sh --dry-run   wypisuje kroki bez wykonania
#   scripts/ios-simulator-build.sh             wykonuje
set -euo pipefail
cd "$(dirname "$0")/.."

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then dry_run=1; fi

step() { echo "# $1"; }
run() { if ((dry_run)); then echo "$*"; else "$@"; fi; }

step "Projekt natywny iOS (expo prebuild, CocoaPods)"
run pnpm --filter @lista/mobile exec expo prebuild --platform ios --clean

# Nazwę projektu Xcode wyprowadza prebuild z nazwy aplikacji, więc odczytujemy ją z wyniku.
if ((dry_run)); then
  project="<projekt>"
else
  workspace=$(find apps/mobile/ios -maxdepth 1 -name '*.xcworkspace' -print -quit)
  project=$(basename "$workspace" .xcworkspace)
fi

step "Build Release na symulator, bez podpisu (ADR 0008: bez dystrybucji iOS)"
run xcodebuild -workspace "apps/mobile/ios/$project.xcworkspace" -scheme "$project" \
  -configuration Release -sdk iphonesimulator -destination "generic/platform=iOS Simulator" \
  -derivedDataPath apps/mobile/ios/build CODE_SIGNING_ALLOWED=NO build
