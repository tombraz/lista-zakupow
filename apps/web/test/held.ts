/**
 * Odpowiedź MSW wstrzymana do `release()`. Test sprawdza stan „w trakcie” (ładowanie, zapis,
 * kliknięcia w czasie zapisu) bez wyścigu z `delay(ms)`, który pod obciążeniem mija, zanim test
 * zrobi swoje kroki (T-021).
 */
export function heldResponse() {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { released, release };
}

export type HeldResponse = ReturnType<typeof heldResponse>;
