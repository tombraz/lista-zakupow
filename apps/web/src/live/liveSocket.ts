import { LIVE_LIMITS, type LiveServerMessage } from "@lista/shared";

type Listener = (message: LiveServerMessage) => void;

// Serwer pinguje co 25 s; bez pingu dłużej niż 25 + 10 s połączenie uznajemy za zerwane.
const SILENCE_LIMIT_MS = (LIVE_LIMITS.pingIntervalSeconds + LIVE_LIMITS.pongTimeoutSeconds) * 1000;
const MAX_RETRY_MS = 10_000;

/** Adres `/api/v1/live` tego samego originu (ADR 0006); sesja w ciasteczku, nigdy w adresie (TH-16). */
export function liveUrl(location: Location = window.location): string {
  const url = new URL("/api/v1/live", location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/**
 * Jedno połączenie WebSocket zalogowanego domownika (architecture.md, „Zmiany na żywo”):
 * odpowiada na ping, po zerwaniu łączy się ponownie i odnawia subskrypcje list.
 */
export class LiveSocket {
  private socket: WebSocket | null = null;
  private readonly lists = new Map<string, number>();
  private readonly listeners = new Set<Listener>();
  private readonly reconnectListeners = new Set<() => void>();
  private readonly dropListeners = new Set<() => void>();
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private silenceTimer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private wasOpen = false;
  /** Gniazdo działa: otwarte i subskrypcje sprzed otwarcia potwierdzone (`subscribed`). */
  private connected = true;
  private browserOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  /** Listy subskrybowane przy otwarciu, czekające na potwierdzenie serwera. */
  private readonly unconfirmed = new Set<string>();
  private readonly statusListeners = new Set<() => void>();
  private readonly goOffline = () => {
    this.browserOnline = false;
    this.notifyStatus();
    // Gniazdo potrafi wisieć „otwarte” bez sieci (tryb samolotowy): zamykamy je od razu, by po
    // powrocie sieci otworzyć nowe, odnowić subskrypcje i pobrać stan (F-15).
    if (this.socket) {
      this.socket.close();
      this.reconnect();
    }
  };
  private readonly goOnline = () => {
    this.browserOnline = true;
    this.notifyStatus();
    if (this.socket || !this.running) return;
    clearTimeout(this.retryTimer);
    this.retries = 0;
    this.open();
  };

  constructor(private readonly url: string) {}

  /** Otwiera połączenie (po zalogowaniu); subskrypcje sprzed otwarcia idą zaraz po nim. */
  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener("offline", this.goOffline);
    window.addEventListener("online", this.goOnline);
    if (this.browserOnline) this.open();
    else this.markDropped();
  }

  /** Subskrypcja listy (SC-06, SC-07); zwraca rezygnację. Kilka ekranów może słuchać tej samej. */
  subscribe(listId: string): () => void {
    const count = this.lists.get(listId) ?? 0;
    this.lists.set(listId, count + 1);
    if (count === 0) this.send({ type: "subscribe", listId });
    return () => {
      const left = (this.lists.get(listId) ?? 1) - 1;
      if (left > 0) {
        this.lists.set(listId, left);
        return;
      }
      this.lists.delete(listId);
      this.send({ type: "unsubscribe", listId });
      this.confirm(listId);
    };
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Po ponownym połączeniu: stan mógł się zmienić, gdy nie było połączenia (F-15). */
  onReconnect(listener: () => void): () => void {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  /**
   * Po zerwaniu połączenia (także nieudanej próbie): API zamyka je np. po wylogowaniu w innej
   * karcie (TH-17), a bez sesji odrzuca ponowne (T-018).
   */
  onDrop(listener: () => void): () => void {
    this.dropListeners.add(listener);
    return () => {
      this.dropListeners.delete(listener);
    };
  }

  /**
   * Połączenie działa (F-15): przeglądarka online, gniazdo otwarte i subskrypcje potwierdzone.
   * Przed pierwszym połączeniem `true`, żeby pasek nie mignął przy każdym wejściu.
   */
  isOnline(): boolean {
    return this.browserOnline && this.connected;
  }

  /** Zmiana `isOnline()` (pasek „Brak połączenia”, blokada zapisów). */
  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Zamyka połączenie bez ponawiania (wylogowanie, odmontowanie). */
  stop(): void {
    this.running = false;
    window.removeEventListener("offline", this.goOffline);
    window.removeEventListener("online", this.goOnline);
    clearTimeout(this.retryTimer);
    clearTimeout(this.silenceTimer);
    this.socket?.close();
    this.socket = null;
  }

  private open(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.retries = 0;
      this.expectPing();
      this.unconfirmed.clear();
      for (const listId of this.lists.keys()) {
        this.unconfirmed.add(listId);
        this.send({ type: "subscribe", listId });
      }
      this.confirm(null);
      if (this.wasOpen) for (const listener of this.reconnectListeners) listener();
      this.wasOpen = true;
    });
    socket.addEventListener("message", (event: MessageEvent<unknown>) => {
      this.receive(event.data);
    });
    socket.addEventListener("close", () => {
      if (this.socket === socket) this.reconnect();
    });
  }

  private receive(data: unknown): void {
    if (typeof data !== "string") return;
    let message: LiveServerMessage;
    try {
      message = JSON.parse(data) as LiveServerMessage;
    } catch {
      return;
    }
    if (message.type === "ping") {
      this.expectPing();
      this.send({ type: "pong" });
      return;
    }
    // Odmowa (`error not_found`) też kończy oczekiwanie: ekran listy obsługuje ją sam.
    if (message.type === "subscribed" || message.type === "error") {
      if ("listId" in message) this.confirm(message.listId);
    }
    for (const listener of this.listeners) listener(message);
  }

  private expectPing(): void {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      // Serwer milczy: gniazdo może wisieć bez zdarzenia „close” (uśpiony telefon, zmiana sieci).
      this.socket?.close();
      this.reconnect();
    }, SILENCE_LIMIT_MS);
  }

  /** Lista potwierdzona (albo `null`: tylko sprawdzenie); po ostatniej połączenie działa. */
  private confirm(listId: string | null): void {
    if (listId !== null) this.unconfirmed.delete(listId);
    if (this.connected || this.unconfirmed.size > 0) return;
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.connected = true;
    this.notifyStatus();
  }

  private markDropped(): void {
    if (!this.connected) return;
    this.connected = false;
    this.notifyStatus();
  }

  private notifyStatus(): void {
    for (const listener of this.statusListeners) listener();
  }

  private reconnect(): void {
    clearTimeout(this.silenceTimer);
    this.socket = null;
    if (!this.running) return;
    this.markDropped();
    for (const listener of this.dropListeners) listener();
    clearTimeout(this.retryTimer);
    const delay = Math.min(1000 * 2 ** this.retries, MAX_RETRY_MS);
    this.retries += 1;
    this.retryTimer = setTimeout(() => {
      // Bez sieci czekamy na zdarzenie `online` przeglądarki (`goOnline`).
      if (this.browserOnline) this.open();
    }, delay);
  }

  private send(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
