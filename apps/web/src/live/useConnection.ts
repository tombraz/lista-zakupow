import { useCallback, useSyncExternalStore } from "react";
import { useLive } from "./LiveProvider";

const alwaysOnline = () => true;
const noSubscription = () => () => undefined;

/**
 * Stan połączenia (F-15, architecture.md „Zmiany na żywo”): `online` fałszywe, gdy przeglądarka
 * jest offline albo połączenie na żywo zerwane i jeszcze nie odnowione. Ekrany i komponenty
 * zapisu wyłączają wtedy akcje zapisu; AppBar pokazuje OfflineBanner. Poza zalogowaną częścią
 * aplikacji (bez `LiveProvider`) zawsze `online`: publiczne ekrany mają własny błąd sieci.
 */
export function useConnection(): { online: boolean } {
  const live = useLive();
  const subscribe = useCallback(
    (listener: () => void) => (live ? live.onStatus(listener) : noSubscription()),
    [live],
  );
  const online = useSyncExternalStore(subscribe, live ? () => live.isOnline() : alwaysOnline);
  return { online };
}
