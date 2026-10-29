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
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private silenceTimer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private wasOpen = false;

  constructor(private readonly url: string) {}

  /** Otwiera połączenie (po zalogowaniu); subskrypcje sprzed otwarcia idą zaraz po nim. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.open();
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

  /** Zamyka połączenie bez ponawiania (wylogowanie, odmontowanie). */
  stop(): void {
    this.running = false;
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
      for (const listId of this.lists.keys()) this.send({ type: "subscribe", listId });
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

  private reconnect(): void {
    clearTimeout(this.silenceTimer);
    this.socket = null;
    if (!this.running) return;
    clearTimeout(this.retryTimer);
    const delay = Math.min(1000 * 2 ** this.retries, MAX_RETRY_MS);
    this.retries += 1;
    this.retryTimer = setTimeout(() => {
      this.open();
    }, delay);
  }

  private send(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
