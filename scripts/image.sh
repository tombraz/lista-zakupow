#!/usr/bin/env bash
# Obraz aplikacji (T-010; pipeline.md, etapy 3–4): jeden obraz na commit z API i zbudowanym web,
# skan Trivy (TH-22: blokuje high/critical z dostępną poprawką) i publikacja w GHCR.
#   scripts/image.sh [--dry-run] build <sha>   buduje ghcr.io/tombraz/lista-zakupow:<sha> z Dockerfile
#   scripts/image.sh [--dry-run] scan <sha>    Trivy na lokalnym obrazie; exit 1 przy podatności
#   scripts/image.sh [--dry-run] push <sha>    wysyła obraz (wymaga docker login ghcr.io)
set -euo pipefail
cd "$(dirname "$0")/.."
# Git Bash na Windows: bez konwersji ścieżki gniazda Dockera.
export MSYS_NO_PATHCONV=1

IMAGE_REPO=ghcr.io/tombraz/lista-zakupow
SOURCE=https://github.com/tombraz/lista-zakupow
TRIVY=aquasec/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c

usage() {
  echo "Użycie: scripts/image.sh [--dry-run] <build|scan|push> <sha>" >&2
  exit 2
}

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then
  dry_run=1
  shift
fi
(($# == 2)) || usage
action=$1 sha=$2
if [[ ! "$sha" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "Niepoprawny sha: $sha (oczekiwano 7–40 znaków szesnastkowych)" >&2
  usage
fi
image=$IMAGE_REPO:$sha

step() { echo "# $1"; }
run() { if ((dry_run)); then echo "$*"; else "$@"; fi; }

case "$action" in
  build)
    step "Build obrazu $image (API + apps/web/dist)"
    run docker build --pull --tag "$image" \
      --label "org.opencontainers.image.revision=$sha" \
      --label "org.opencontainers.image.source=$SOURCE" .
    ;;
  scan)
    step "Trivy: high/critical z dostępną poprawką zatrzymują wdrożenie (TH-22)"
    run docker run --rm -v /var/run/docker.sock:/var/run/docker.sock "$TRIVY" image \
      --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed --no-progress "$image"
    ;;
  push)
    step "Publikacja $image w GHCR"
    run docker push "$image"
    ;;
  *)
    echo "Nieznana akcja: $action" >&2
    usage
    ;;
esac
