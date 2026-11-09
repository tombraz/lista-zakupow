/** Nazwa aplikacji (Copy w `design-system.md`: `product.name`). */
export const PRODUCT_NAME = "Wspólna lista zakupów";

/** Tytuł karty przeglądarki (Copy w `design-system.md`: `product.documentTitle`). */
export function documentTitle(title: string): string {
  return `${title} · ${PRODUCT_NAME}`;
}
