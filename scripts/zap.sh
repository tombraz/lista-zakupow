#!/usr/bin/env bash
# ZAP baseline na staging (T-010, AC4; pipeline.md, etap 3): skan pasywny, progi w .zap/rules.tsv
# (FAIL m.in. dla braku CSP i HSTS), a każdy alert wysoki kończy skan porażką. Nigdy na produkcji.
# Referrer-Policy nie ma reguły w ZAP; jej brak zatrzymuje scripts/smoke.sh (SEC2).
#   scripts/zap.sh --dry-run <staging|http(s)://host[:port]>   wypisuje komendy bez wykonania
#   scripts/zap.sh <staging|http(s)://host[:port]>             wykonuje (Docker); raport w zap-report/
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

ZAP=ghcr.io/zaproxy/zaproxy:2.17.0@sha256:030d3df57735dacbb83464854758e674dd9ad01d79d12a129a8e58b1fd384238
REPORT_DIR=zap-report

usage() {
  echo "Użycie: scripts/zap.sh [--dry-run] <staging|http(s)://host[:port]>" >&2
  exit 2
}

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then
  dry_run=1
  shift
fi
(($# == 1)) || usage
case "$1" in
  staging) target=https://lista-staging.fly.dev ;;
  production)
    echo "Skan ZAP tylko na staging (pipeline.md): produkcja odrzucona" >&2
    usage
    ;;
  *)
    [[ "$1" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] || usage
    target=$1
    ;;
esac

# Docker Desktop na Windows potrzebuje ścieżki w postaci C:/...
host_dir=$PWD/$REPORT_DIR
if command -v cygpath >/dev/null; then host_dir=$(cygpath -m "$host_dir"); fi

step() { echo "# $1"; }
run() { if ((dry_run)); then echo "$*"; else "$@"; fi; }

step "ZAP baseline (pasywny) $target, reguły .zap/rules.tsv, raport w $REPORT_DIR/"
run mkdir -p "$REPORT_DIR"
run cp .zap/rules.tsv "$REPORT_DIR/rules.tsv"
# Kontener ZAP działa jako inny użytkownik niż runner: katalog raportu musi być zapisywalny.
run chmod a+rwx "$REPORT_DIR"
# -I: ostrzeżenia (WARN) nie kończą skanu porażką; reguły FAIL tak (exit 1).
run docker run --rm -v "$host_dir:/zap/wrk:rw" "$ZAP" zap-baseline.py -t "$target" -c rules.tsv \
  -J report.json -r report.html -I

step "Alerty wysokie (riskcode 3) w raporcie = porażka"
run node scripts/zap-high-alerts.mjs "$REPORT_DIR/report.json"
