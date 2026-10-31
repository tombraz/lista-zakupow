// Granica systemu w testach ekranów: przywraca fetch API z Node (zapamiętane w test/environment.js)
// po setupie presetu Expo, żeby żądania przechwytywał MSW (layers/mobile.md, „Testy”).
for (const [name, value] of Object.entries(globalThis.__nodeFetchApi)) {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
}
