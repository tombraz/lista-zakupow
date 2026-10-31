#!/usr/bin/env bash
# Obraz zbudowany lokalnie (T-010, test 4; rung 2–3): migracje z obrazu, potem api i web pod jednym
# portem przechodzą scripts/smoke.sh; kontener działa bez roota. Wymaga Dockera; baza z docker-compose.yml.
#   scripts/test/image-run.test.sh [sha]   bez sha: buduje obraz z bieżącego drzewa jako :0000000
set -euo pipefail
cd "$(dirname "$0")/../.."
export MSYS_NO_PATHCONV=1

sha=${1:-0000000}
image=ghcr.io/tombraz/lista-zakupow:$sha
port=${IMAGE_TEST_PORT:-8090}
container=lista-image-test-$$
# Kontener widzi bazę z docker-compose.yml na hoście (port 5442); host-gateway działa też na Linuksie.
database_url=postgres://lista:lista@host.docker.internal:5442/lista
docker_run=(docker run --rm --add-host=host.docker.internal:host-gateway -e "DATABASE_URL=$database_url")

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

if [[ -z "${1-}" ]]; then bash scripts/image.sh build "$sha"; fi
docker compose up -d --wait postgres

migrate_status=0
"${docker_run[@]}" "$image" node apps/api/dist/db/migrate.js || migrate_status=$?
check "migracje z obrazu (release_command) przechodzą" "0" "$migrate_status"

check "kontener działa bez roota" "1000" "$(docker run --rm "$image" id -u)"

trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
"${docker_run[@]}" -d --name "$container" -p "127.0.0.1:$port:8080" \
  -e "APP_ORIGIN=http://localhost:$port" -e "BETTER_AUTH_SECRET=$(openssl rand -hex 32)" "$image" >/dev/null

smoke_status=0
bash scripts/smoke.sh "http://localhost:$port" || smoke_status=$?
check "api i web pod jednym portem przechodzą smoke test" "0" "$smoke_status"
if ((smoke_status)); then docker logs "$container" 2>&1 | tail -20; fi

exit "$failures"
