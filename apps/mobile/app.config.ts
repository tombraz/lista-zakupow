import type { ConfigContext, ExpoConfig } from "expo/config";
import { withAndroidManifest } from "expo/config-plugins";

// Identyfikator aplikacji (Android i iOS); dystrybucja bez sklepów (tech-stack.md, ADR 0008).
const APP_ID = "dev.tombraz.listazakupow";
// Emulator Androida widzi lokalne api pod 10.0.2.2 (layers/mobile.md, „Pułapki”).
const LOCAL_API_URL = "http://10.0.2.2:3000";

/**
 * Android blokuje HTTP bez TLS w buildzie wydania. Zezwolenie tylko dla lokalnego api po `http://`
 * (emulator, Maestro); staging i produkcja używają HTTPS (TH-24), więc ich buildy go nie mają.
 */
function withLocalCleartextApi(config: ExpoConfig, apiUrl: string): ExpoConfig {
  if (!apiUrl.startsWith("http://")) return config;
  return withAndroidManifest(config, (modConfig) => {
    for (const application of modConfig.modResults.manifest.application ?? []) {
      application.$["android:usesCleartextTraffic"] = "true";
    }
    return modConfig;
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  // Typy Expo deklarują wartości process.env jako any.
  const apiUrl = (process.env["API_URL"] as string | undefined) ?? LOCAL_API_URL;
  return withLocalCleartextApi(
    {
      ...config,
      name: "Wspólna lista zakupów",
      slug: "lista-zakupow",
      version: "0.0.0",
      orientation: "portrait",
      plugins: ["expo-router"],
      android: { package: APP_ID },
      ios: { bundleIdentifier: APP_ID, supportsTablet: false },
      // Tylko publiczny adres API: wszystko w `extra` trafia do paczki aplikacji (TH-23).
      extra: { apiUrl },
    },
    apiUrl,
  );
};
