import { LIVE_LIMITS } from "@lista/shared";

/**
 * TH-25: najwyżej `messagesPerSecond` wiadomości klienta w każdym oknie jednej sekundy
 * (okno przesuwne). `now` — milisekundy (zegar wstrzykiwany).
 */
export class MessageBudget {
  private readonly times: number[] = [];

  constructor(private readonly now: () => number) {}

  /** `false`, gdy wiadomość przekracza limit: połączenie trzeba zamknąć. */
  take(): boolean {
    const at = this.now();
    while (this.times.length > 0 && (this.times[0] ?? at) <= at - 1000) this.times.shift();
    this.times.push(at);
    return this.times.length <= LIVE_LIMITS.messagesPerSecond;
  }
}
