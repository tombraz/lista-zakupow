/**
 * Przeglądarka zdejmuje fokus z elementu, który dostaje `disabled` (także przez `fieldset`), i fokus
 * spada na `body`; jsdom go zostawia. Bez tej atrapy test komponentu nie widzi utraty fokusu
 * (T-015, T-023; `layers/web.md` „Pułapki”).
 */
export function blurOnDisabled() {
  const observer = new MutationObserver(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || !focused.matches(":disabled")) return;
    // jsdom ignoruje `blur()` elementu `disabled` (nie jest już fokusowalny): fokus na chwilowy
    // element i jego usunięcie zostawia `document.activeElement` na `body`.
    const sink = document.createElement("span");
    sink.tabIndex = -1;
    document.body.append(sink);
    sink.focus();
    sink.remove();
  });
  observer.observe(document, { attributes: true, attributeFilter: ["disabled"], subtree: true });
}
