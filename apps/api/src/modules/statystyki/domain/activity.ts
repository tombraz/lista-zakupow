/** Strefa dnia aktywności: pilotaż jest w Polsce (T-007). */
export const ACTIVITY_TIME_ZONE = "Europe/Warsaw";

// `en-CA` formatuje datę jako RRRR-MM-DD, czyli w formacie kolumny `date`.
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ACTIVITY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dzień aktywności (BRD §10: „dni z ≥ 3 odhaczonymi pozycjami”) dla chwili odhaczenia. */
export function activityDay(at: Date): string {
  return dayFormat.format(at);
}
