#!/usr/bin/env bash
# Testy przebiegu komentarzy z `pnpm lint` (T-046; obejścia z T-030, T-044, T-045): każde obejście
# pada z oczekiwaną regułą, dozwolony `eslint-disable-next-line` przechodzi. Polecenie pochodzi
# ze skryptu `lint` w package.json (część po ostatnim `&&`), treść idzie przez --stdin, więc
# w drzewie nie powstają pliki.
set -euo pipefail
cd "$(dirname "$0")/../.."
PATH="$PWD/node_modules/.bin:$PATH"

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

lint_cmd=$(node -p "require('./package.json').scripts.lint.split('&&').pop().trim()")
check "skrypt lint ma przebieg eslint.directives.config.js" "1" \
  "$(grep -c -- '-c eslint.directives.config.js' <<<"$lint_cmd" || true)"

# Wynik przebiegu: kod wyjścia i reguły ze zgłoszeń (porównanie po nazwie reguły, nie po linii).
lint() {
  local file=$1 src=$2 out status=0
  # shellcheck disable=SC2086 # polecenie ze skryptu lint dzielone na słowa jak w pnpm run
  out=$(printf '%s\n' "$src" | $lint_cmd --stdin --stdin-filename "$file" 2>&1) || status=$?
  # Tylko kolumna reguły (ostatnia w wierszu zgłoszenia): treść komunikatu też zawiera nazwy reguł.
  echo "$status $(tr -d '\r' <<<"$out" | awk '/ error | warning /{print $NF}' |
    grep -E '^eslint-comments/' | sort -u | tr '\n' ' ' || true)"
}

# Obejście pada (exit 1) i zgłoszenie ma oczekiwaną regułę.
rejected() {
  local name=$1 file=$2 rule=$3 src=$4 result
  result=$(lint "$file" "$src")
  check "$name ($file)" "1 $rule" "${result%% *} $(grep -oE "$rule" <<<"$result" | head -1 || true)"
}

no_use=eslint-comments/no-use
no_disable=eslint-comments/no-restricted-disable

rejected "1. komentarz konfiguracyjny wyłącza no-use i no-restricted-syntax" apps/api/src/x.ts "$no_use" \
  '/* eslint eslint-comments/no-use: off, no-restricted-syntax: off */
log.warn({ event: "rate_limited" });'
rejected "2. eslint-disable no-use nad komentarzem konfiguracyjnym" apps/api/src/x.ts "$no_disable" \
  '/* eslint-disable eslint-comments/no-use */
/* eslint no-restricted-syntax: off */
log.warn({ event: "rate_limited" });'
rejected "2. eslint-disable no-use nad komentarzem konfiguracyjnym" apps/web/src/x.tsx "$no_use" \
  '/* eslint-disable eslint-comments/no-use */
/* eslint no-restricted-syntax: off */
export const a = 1;'
rejected "3. eslint-disable bez nazwy reguły" apps/web/test/x.ts "$no_disable" \
  '/* eslint-disable */
export const a = 1;'
rejected "4. eslint-disable-next-line no-restricted-syntax" packages/shared/src/x.ts "$no_disable" \
  '// eslint-disable-next-line no-restricted-syntax
export const a = 1;'
rejected "4. eslint-disable-next-line no-restricted-imports" apps/web/src/x.tsx "$no_disable" \
  '// eslint-disable-next-line no-restricted-imports
import { a } from "../x";'
rejected "5. eslint-disable-next-line no-restricted-disable" packages/shared/src/x.tsx "$no_disable" \
  '// eslint-disable-next-line eslint-comments/no-restricted-disable
// eslint-disable-next-line no-restricted-syntax
export const a = 1;'
rejected "6. /* eslint reguła: [...] */" apps/api/src/x.ts "$no_use" \
  '/* eslint no-restricted-syntax: ["error"] */
export const a = 1;'
rejected "6. /* global */" apps/web/src/x.ts "$no_use" \
  '/* global foo */
export const a = foo;'
rejected "6. /* globals */" apps/web/test/x.tsx "$no_use" \
  '/* globals bar */
export const a = bar;'
rejected "6. /* eslint-env */" packages/shared/src/x.ts "$no_use" \
  '/* eslint-env node */
export const a = 1;'
rejected "6. /* exported */" apps/api/src/x.ts "$no_use" \
  '/* exported baz */
export const baz = 1;'

check "dozwolony eslint-disable-next-line react-hooks/exhaustive-deps (apps/web/src/x.tsx)" "0 " \
  "$(lint apps/web/src/x.tsx '// eslint-disable-next-line react-hooks/exhaustive-deps
export const a = 1;')"

exit "$failures"
