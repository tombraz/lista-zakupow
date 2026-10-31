import { afterEach, describe, expect, it } from "@jest/globals";
import type { ConfigContext, ExpoConfig } from "expo/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import appConfig from "../app.config";

type ApplicationAttributes = Record<string, string | undefined>;
type ManifestMod = (config: object) => Promise<{
  modResults: { manifest: { application: { $: ApplicationAttributes }[] } };
}>;

/** Atrybuty <application> po zastosowaniu modyfikacji manifestu Androida z konfiguracji. */
async function androidApplicationAttributes(config: ExpoConfig): Promise<ApplicationAttributes> {
  const manifest = {
    manifest: { $: {}, application: [{ $: { "android:name": ".MainApplication" } }] },
  };
  const mods = (config as { mods?: { android?: { manifest?: ManifestMod } } }).mods;
  const mod = mods?.android?.manifest;
  const result = mod
    ? await mod({ ...config, modResults: manifest, modRequest: {} })
    : { modResults: manifest };
  return result.modResults.manifest.application[0]?.$ ?? {};
}

const context = { config: {} } as ConfigContext;
const originalApiUrl = process.env["API_URL"] as string | undefined;

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env["API_URL"];
  else process.env["API_URL"] = originalApiUrl;
});

describe("app.config (SEC1, TH-23)", () => {
  it("exposes only the public API address in extra", () => {
    process.env["API_URL"] = "https://lista-staging.fly.dev";

    expect(appConfig(context).extra).toEqual({ apiUrl: "https://lista-staging.fly.dev" });
  });

  it("points the Android emulator at the local API by default", () => {
    delete process.env["API_URL"];

    expect(appConfig(context).extra).toEqual({ apiUrl: "http://10.0.2.2:3000" });
  });

  it.each<[string, string | undefined]>([
    ["http://10.0.2.2:3000", "true"],
    ["https://lista-staging.fly.dev", undefined],
  ])("with API %s sets Android cleartext traffic to %s", async (url, expected) => {
    process.env["API_URL"] = url;

    const attributes = await androidApplicationAttributes(appConfig(context));

    expect(attributes["android:usesCleartextTraffic"]).toBe(expected);
  });

  it("does not ship the development client (no developer menu in a release build)", () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies)).not.toContain("expo-dev-client");
  });
});
