import { Navigate, Outlet, useLocation } from "react-router";
import { afterEntry, type EntryState } from "../invitations/invitationContext";
import { LiveProvider } from "../live/LiveProvider";
import { useEndSessionOnUnauthenticated, useSession, useSessionEnd } from "./useSession";

/**
 * Trasy dla zalogowanych; anonim trafia na SC-01 i po zalogowaniu wraca (ia.md, „Nawigacja”).
 * Zalogowany ma jedno połączenie na żywo; wylogowanie je zamyka (architecture.md).
 * 401 z API w trakcie pracy kończy sesję i też prowadzi na SC-01 (T-018).
 */
export function RequireSession() {
  const session = useSession();
  const location = useLocation();
  const ended = useSessionEnd();
  useEndSessionOnUnauthenticated();
  if (session.isPending) return <main aria-busy="true" />;
  if (!session.data) {
    // Po usunięciu konta SC-01 z komunikatem i bez powrotu na ekran konta, którego już nie ma.
    const state: EntryState | { from: string } =
      ended === "accountDeleted" ? { accountDeleted: true } : { from: location.pathname };
    return <Navigate to="/logowanie" replace state={state} />;
  }
  return (
    <LiveProvider>
      <Outlet />
    </LiveProvider>
  );
}

/** Adres, z którego przekierowano na logowanie; domyślnie „Moje listy”. */
function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  // Tylko ścieżka w aplikacji; `//host` byłby adresem innej domeny.
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
    ? from
    : "/listy";
}

/**
 * SC-01, SC-02: zalogowany domownik od razu na „Moje listy” albo tam, skąd przyszedł —
 * także zaraz po zalogowaniu lub rejestracji (formularz tylko ustawia sesję). Z kontekstem
 * zaproszenia: na udostępnioną listę albo na SC-08, który od razu dołącza (`afterEntry`).
 */
export function PublicOnly() {
  const session = useSession();
  const location = useLocation();
  if (session.isPending) return <main aria-busy="true" />;
  if (session.data) {
    const next = afterEntry(location.state);
    if (next) return <Navigate to={next.to} replace state={next.state} />;
    return <Navigate to={returnPath(location.state)} replace />;
  }
  return <Outlet />;
}
