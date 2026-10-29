#!/usr/bin/env bash
# Wdrożenie obrazu z GHCR na Fly (T-010; pipeline.md, etapy 4–6). Migracje wykonuje release_command
# z apps/api/fly.<środowisko>.toml przed startem nowej wersji: nieudana migracja przerywa wdrożenie,
# poprzednia wersja działa dalej. --ha=false: jedna maszyna (ADR 0003: jedna instancja API — hub
# zmian na żywo jest w pamięci procesu; deployment.md: 1 maszyna).
#   scripts/deploy.sh --dry-run <środowisko> <sha>   wypisuje komendy bez wykonania
#   scripts/deploy.sh <środowisko> <sha>             wykonuje; wymaga flyctl i FLY_API_TOKEN w środowisku
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE_REPO=ghcr.io/tombraz/lista-zakupow

usage() {
  echo "Użycie: scripts/deploy.sh [--dry-run] <środowisko> <sha>" >&2
  exit 2
}

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then
  dry_run=1
  shift
fi
(($# == 2)) || usage
environment=$1 sha=$2
if [[ ! "$environment" =~ ^[a-z]+$ ]]; then
  echo "Niepoprawne środowisko: $environment" >&2
  usage
fi
if [[ ! "$sha" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "Niepoprawny sha: $sha (oczekiwano 7–40 znaków szesnastkowych)" >&2
  usage
fi
config=apps/api/fly.$environment.toml
if [[ ! -f "$config" ]]; then
  echo "Brak konfiguracji Fly dla środowiska $environment: $config" >&2
  exit 2
fi
image=$IMAGE_REPO:$sha

step() { echo "# $1"; }
run() { if ((dry_run)); then echo "$*"; else "$@"; fi; }

step "Wdrożenie obrazu $image na $environment ($config; migracje jako release_command)"
run flyctl deploy --config "$config" --image "$image" --wait-timeout 10m0s --ha=false
