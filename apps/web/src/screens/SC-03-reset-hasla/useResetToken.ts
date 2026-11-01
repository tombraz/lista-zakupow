import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Stan nawigacji SC-03: token z linku po zdjęciu go z adresu albo `newLink` — krok 1 po
 * „Wyślij nowy link” (fokus na nagłówku).
 */
export interface ResetState {
  resetToken?: string;
  newLink?: true;
}

// Kropka zdania z treści maila (Copy `mail.body`: „…{link}. Jeśli…”), którą część programów
// pocztowych dołącza do adresu; token Better Auth ma tylko litery i cyfry (QA T-053 #2).
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

function tokenOfState(state: unknown): string | null {
  const token = (state as Partial<ResetState> | null)?.resetToken;
  return typeof token === "string" ? token : null;
}

/** Krok 1 otwarty z kroku 2 przyciskiem „Wyślij nowy link”. */
export function isNewLinkRequest(state: unknown): boolean {
  return (state as ResetState | null)?.newLink === true;
}

/**
 * Token z linku w mailu (`/reset-hasla?token=…`). Przy wejściu zdejmuje go z paska adresu
 * (`replace`, TH-21: nie zostaje w adresie ani w `Referer`) i trzyma w stanie nawigacji, więc
 * przeładowanie strony nadal pokazuje krok 2.
 */
export function useResetToken(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const fromAddress =
    new URLSearchParams(location.search).get("token")?.replace(TRAILING_PUNCTUATION, "") ?? null;

  useEffect(() => {
    if (fromAddress === null) return;
    void navigate(
      { pathname: location.pathname, search: "" },
      { replace: true, state: { resetToken: fromAddress } satisfies ResetState },
    );
  }, [fromAddress, location.pathname, navigate]);

  return fromAddress ?? tokenOfState(location.state);
}
