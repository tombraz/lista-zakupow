import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LISTS_KEY } from "../lists/useLists";
import { LiveSocket, liveUrl } from "./liveSocket";

const LiveContext = createContext<LiveSocket | null>(null);

/**
 * Jedno połączenie na żywo zalogowanego domownika (kanał `user:<id>`): `lists.changed` i powrót
 * połączenia odświeżają SC-05 (F-14, F-15). Zamykane przy wylogowaniu (odmontowanie).
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [live] = useState(() => new LiveSocket(liveUrl()));

  useEffect(() => {
    const refreshLists = () => {
      void client.invalidateQueries({ queryKey: LISTS_KEY, exact: true });
    };
    const stopListening = live.onMessage((message) => {
      if (message.type === "lists.changed") refreshLists();
    });
    const stopRefreshing = live.onReconnect(refreshLists);
    live.start();
    return () => {
      stopListening();
      stopRefreshing();
      live.stop();
    };
  }, [live, client]);

  return <LiveContext value={live}>{children}</LiveContext>;
}

/** Połączenie na żywo (`null` poza zalogowaną częścią aplikacji). */
export function useLive(): LiveSocket | null {
  return useContext(LiveContext);
}
