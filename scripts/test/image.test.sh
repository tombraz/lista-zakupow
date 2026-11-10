#!/usr/bin/env bash
# Testy skryptu obrazu (T-010; drabina weryfikacji, rung 2): --dry-run wypisuje komendy docker / Trivy,
# niepoprawne argumenty kończą się błędem; pin obrazu bazowego (T-122). Uruchomienie obrazu sprawdza
# scripts/test/image-run.test.sh.
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

# Pin obrazu bazowego (T-122, TH-22): każde FROM to dosłowne obraz:tag@sha256 (Dependabot docker nie
# aktualizuje FROM ${ARG}), major Node w tagu = .nvmrc, dependabot.yml ma ekosystem docker.
pin_errors() {
  local dockerfile=$1 dependabot=$2 nvmrc=$3 stages=" " node_from=0 keyword image rest major
  while read -r keyword image rest; do
    [[ "${keyword^^}" == FROM ]] || continue
    if [[ "$image" == *'$'* ]]; then
      echo "FROM $image: obraz z ARG (Dependabot go nie aktualizuje)"
    elif [[ "$stages" == *" $image "* ]]; then
      :
    elif [[ ! "$image" =~ ^[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$ ]]; then
      echo "FROM $image: brak tagu i digestu sha256"
    elif [[ "$image" == node:* ]]; then
      node_from=1
      major=${image#node:}
      major=${major%%.*}
      [[ "$major" == "$(tr -d '[:space:]' <"$nvmrc")" ]] || echo "FROM $image: Node $major ≠ .nvmrc"
    fi
    if [[ "${rest^^}" =~ ^AS[[:space:]]+([^[:space:]]+) ]]; then stages+="${rest##* } "; fi
  done < <(tr -d '\r' <"$dockerfile")
  ((node_from)) || echo "brak FROM node:<tag>@sha256"
  grep -Eq '^[[:space:]]*-[[:space:]]+package-ecosystem:[[:space:]]+docker[[:space:]]*$' "$dependabot" \
    || echo "dependabot.yml bez package-ecosystem: docker"
}

check "pin obrazu w repo (Dockerfile, dependabot.yml, .nvmrc)" "" \
  "$(pin_errors Dockerfile .github/dependabot.yml .nvmrc)"

fixtures=$(mktemp -d)
trap 'rm -rf "$fixtures"' EXIT
digest=sha256:$(printf '0%.0s' {1..64})
printf '24\n' >"$fixtures/nvmrc"
printf 'updates:\n  - package-ecosystem: npm\n' >"$fixtures/no-docker.yml"
dockerfile_case() { printf '%s\n' "$@" >"$fixtures/Dockerfile"; pin_errors "$fixtures/Dockerfile" .github/dependabot.yml "$fixtures/nvmrc"; }

check "pin: FROM \${ARG} odrzucony" "FROM \${NODE_IMAGE}: obraz z ARG (Dependabot go nie aktualizuje)
brak FROM node:<tag>@sha256" \
  "$(dockerfile_case "ARG NODE_IMAGE=node:24.22.2-trixie-slim@$digest" 'FROM ${NODE_IMAGE} AS build')"
check "pin: tag bez digestu odrzucony" "FROM node:24-trixie-slim: brak tagu i digestu sha256
brak FROM node:<tag>@sha256" "$(dockerfile_case 'FROM node:24-trixie-slim')"
check "pin: major Node różny od .nvmrc" "FROM node:26.1.0-trixie-slim@$digest: Node 26 ≠ .nvmrc" \
  "$(dockerfile_case "FROM node:26.1.0-trixie-slim@$digest")"
check "pin: FROM etapu i małe litery przechodzą" "" \
  "$(dockerfile_case "from node:24.22.2-trixie-slim@$digest as build" 'FROM build')"
check "pin: dependabot.yml bez docker odrzucony" "dependabot.yml bez package-ecosystem: docker" \
  "$(pin_errors Dockerfile "$fixtures/no-docker.yml" .nvmrc)"

exit "$failures"
