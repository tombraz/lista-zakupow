import { afterEach } from "vitest";

const observers: MutationObserver[] = [];

afterEach(() => {
  for (const observer of observers.splice(0)) observer.disconnect();
});

/**
 * Teksty, które czytnik ekranu ogłosi z regionów `role="status"` (T-071). Liczy się tylko zmiana
 * treści regionu, który był już w drzewie: region wstawiony od razu z tekstem zwykle nie jest
 * ogłaszany (NVDA/JAWS + Chrome), więc tu go nie widać. Wywołaj przed akcją (albo przed
 * `renderApp`, gdy komunikat przychodzi z wejściem na ekran).
 */
export function statusAnnouncements(): string[] {
  const announced: string[] = [];
  const observer = new MutationObserver((records) => {
    const changed = new Set<Element>();
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const region = target?.closest('[role="status"]');
      if (region) changed.add(region);
    }
    for (const region of changed) {
      const text = spokenText(region);
      if (text !== "") announced.push(text);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  observers.push(observer);
  return announced;
}

/** Treść bez elementów `aria-hidden` (ikona komunikatu). */
function spokenText(region: Element): string {
  const copy = region.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent.trim();
}
