import Constants from "expo-constants";

/** Publiczny adres API z konfiguracji Expo (`app.config.ts`, `extra.apiUrl`); bez sekretów (TH-23). */
export function apiUrl(): string {
  const url: unknown = Constants.expoConfig?.extra?.["apiUrl"];
  if (typeof url !== "string") throw new Error("extra.apiUrl is missing in app.config.ts");
  return url;
}
