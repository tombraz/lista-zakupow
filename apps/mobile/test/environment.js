// Środowisko testów ekranów: jak w presecie Expo, plus fetch API z Node zapamiętane dla MSW.
// Setup presetu podmienia globalne fetch / Request / Response / Headers na natywne (w Jest bez
// implementacji); test/node-fetch.js przywraca te z Node, żeby żądania przechwytywał MSW.
const ExpoEnvironment = require("jest-expo/src/preset/nativeEnvironment");

class ScreenTestEnvironment extends ExpoEnvironment {
  constructor(config, context) {
    super(config, context);
    const { fetch, Request, Response, Headers } = globalThis;
    this.global.__nodeFetchApi = { fetch, Request, Response, Headers };
  }
}

module.exports = ScreenTestEnvironment;
