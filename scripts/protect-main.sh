#!/usr/bin/env bash
# Ustawienia repozytorium dla bramek CI (T-002, pipeline.md etapy 1 i 3). Uruchamia właściciel:
#   scripts/protect-main.sh --dry-run [owner/repo]   wypisuje komendy gh bez wykonania
#   scripts/protect-main.sh [owner/repo]             wykonuje je (wymaga gh auth z uprawnieniem admin)
# Domyślne repozytorium: bieżące (gh repo view).
set -euo pipefail

dry_run=0
if [[ "${1-}" == "--dry-run" ]]; then
  dry_run=1
  shift
fi
repo=${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}
if [[ ! "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Niepoprawna nazwa repozytorium: $repo (oczekiwano owner/repo)" >&2
  exit 2
fi

step() { echo "# $1"; }

# gh_api <metoda> <ścieżka> [treść JSON]
gh_api() {
  local method=$1 path=$2 body=${3-}
  if ((dry_run)); then
    echo "gh api --method $method $path${body:+ --input -}"
    if [[ -n "$body" ]]; then echo "$body"; fi
  elif [[ -n "$body" ]]; then
    printf '%s' "$body" | gh api --method "$method" "$path" --input - >/dev/null
  else
    gh api --method "$method" "$path" >/dev/null
  fi
}

step "Ochrona main: tylko przez PR, wymagane checki ci-ok i codeql, bez force push i usuwania"
gh_api PUT "repos/$repo/branches/main/protection" \
  '{"required_status_checks":{"strict":false,"checks":[{"context":"ci-ok"},{"context":"codeql"}]},"enforce_admins":true,"required_pull_request_reviews":{"required_approving_review_count":0},"restrictions":null,"allow_force_pushes":false,"allow_deletions":false}'

step "Secret scanning z push protection (TH-22, TH-23)"
gh_api PATCH "repos/$repo" \
  '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}'

step "Private vulnerability reporting (SECURITY.md)"
gh_api PUT "repos/$repo/private-vulnerability-reporting"

step "Alerty Dependabot (TH-22)"
gh_api PUT "repos/$repo/vulnerability-alerts"

step "CodeQL default setup wyłączony: skanuje workflow security.yml (advanced setup)"
gh_api PATCH "repos/$repo/code-scanning/default-setup" '{"state":"not-configured"}'
