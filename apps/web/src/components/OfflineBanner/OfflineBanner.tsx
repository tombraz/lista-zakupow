import { useState } from "react";
import styles from "./OfflineBanner.module.css";

/** Id paska: nieaktywne przyciski zapisu wskazują go jako wyjaśnienie (`aria-describedby`). */
export const OFFLINE_BANNER_ID = "offline-banner";

const texts = {
  offline: "Brak połączenia. Zmiany nie są zapisywane.",
  restored: "Połączenie przywrócone.",
};

/**
 * OfflineBanner (design-system.md): pod paskiem nagłówka, przesuwa treść. Region `role="status"`
 * jest zawsze w drzewie, więc czytnik ogłasza i pojawienie się paska, i jego zniknięcie
 * (ukryte „Połączenie przywrócone.”).
 */
export function OfflineBanner({ offline }: { offline: boolean }) {
  const restored = useRestored(offline);
  return (
    <div
      id={OFFLINE_BANNER_ID}
      role="status"
      className={offline ? styles.banner : styles.visuallyHidden}
    >
      {offline ? texts.offline : restored ? texts.restored : ""}
    </div>
  );
}

/** Pasek zniknął w czasie życia ekranu (nie: ekran otwarty z działającym połączeniem). */
function useRestored(offline: boolean): boolean {
  const [wasOffline, setWasOffline] = useState(offline);
  if (offline && !wasOffline) setWasOffline(true);
  return wasOffline && !offline;
}
