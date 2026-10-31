#!/usr/bin/env bash
# Jednorazowe przygotowanie staging (T-010; deployment.md, „Sekrety i dostęp”). Uruchamia właściciel
# po założeniu kont Fly i Neon (projekt lista-staging, region AWS Frankfurt eu-central-1):
#   STAGING_DATABASE_URL='postgresql://…?sslmode=require' scripts/staging-setup.sh --dry-run [owner/repo]
#   STAGING_DATABASE_URL='postgresql://…?sslmode=require' scripts/staging-setup.sh [owner/repo]
# Wymaga: flyctl (fly auth login), gh (gh auth login, admin repozytorium), openssl.
# Wartości sekretów idą tylko przez stdin: nie trafiają do argumentów, historii powłoki ani logów.
set -euo pipefail
cd "$(dirname "$0")/.."

APP=lista-staging
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

# SEC3 (TH-07): baza w UE (Frankfurt) i połączenie tylko po TLS.
database_url=${STAGING_DATABASE_URL-}
if [[ -z "$database_url" ]]; then
  echo "Ustaw STAGING_DATABASE_URL (Neon → lista-staging → Connect)" >&2
  exit 2
fi
if [[ ! "$database_url" =~ [?\&]sslmode=require(\&|$) ]]; then
  echo "STAGING_DATABASE_URL musi mieć sslmode=require" >&2
  exit 2
fi
if [[ ! "$database_url" =~ ^postgres(ql)?://[^@]+@[^/]+\.eu-central-1\.aws\.neon\.tech/ ]]; then
  echo "STAGING_DATABASE_URL musi wskazywać bazę Neon w eu-central-1 (Frankfurt)" >&2
  exit 2
fi

step() { echo "# $1"; }

step "Środowisko GitHub staging (sekret FLY_API_TOKEN tylko tam)"
if ((dry_run)); then
  echo "gh api --method PUT repos/$repo/environments/staging"
else
  gh api --method PUT "repos/$repo/environments/staging" >/dev/null
fi

step "Aplikacja Fly $APP (region fra z apps/api/fly.staging.toml)"
if ((dry_run)); then echo "flyctl apps create $APP --org personal"; else flyctl apps create "$APP" --org personal; fi

step "Sekrety Fly ze stdin, bez wartości w argumentach: DATABASE_URL (Neon lista-staging, sslmode=require), BETTER_AUTH_SECRET (losowy)"
if ((dry_run)); then
  echo "flyctl secrets import --app $APP --stage"
else
  printf 'DATABASE_URL=%s\nBETTER_AUTH_SECRET=%s\n' "$database_url" "$(openssl rand -hex 32)" |
    flyctl secrets import --app "$APP" --stage
fi

step "Token wdrożeń tylko dla $APP (rok) prosto do sekretu środowiska staging"
if ((dry_run)); then
  echo "flyctl tokens create deploy --app $APP --expiry 8760h | gh secret set FLY_API_TOKEN --env staging --repo $repo"
else
  flyctl tokens create deploy --app "$APP" --expiry 8760h | gh secret set FLY_API_TOKEN --env staging --repo "$repo"
fi

step "Ręcznie po pierwszym przebiegu deploy.yml: pakiet ghcr.io/tombraz/lista-zakupow → Package settings → Change visibility → Public (Fly pobiera obraz bez logowania)"
