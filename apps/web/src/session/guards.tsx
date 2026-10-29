import { Navigate, Outlet, useLocation } from "react-router";
import { afterEntry } from "../invitations/invitationContext";
import { LiveProvider } from "../live/LiveProvider";
import { useSession } from "./useSession";

/**
 * Trasy dla zalogowanych; anonim trafia na SC-01 i po zalogowaniu wraca (ia.md, „Nawigacja”).
 * Zalogowany ma jedno połączenie na żywo; wylogowanie je zamyka (architecture.md).
 */
export function RequireSession() {
  const session = useSession();
  const location = useLocation();
  if (session.isPending) return <main aria-busy="true" />;
  if (!session.data) {
    return <Navigate to="/logowanie" replace state={{ from: location.pathname }} />;
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
