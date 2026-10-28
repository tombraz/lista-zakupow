import type { ReactNode } from "react";
import { Link } from "react-router";
import type { EntryState, InvitationContext } from "./invitationContext";

interface EntryLinkProps {
  to: "/logowanie" | "/rejestracja";
  email: string;
  invitation: InvitationContext | null;
  className?: string | undefined;
  children: ReactNode;
}

/** SC-01 ↔ SC-02 z wpisanym e-mailem (3.3.7) i kontekstem zaproszenia (SC-08). */
export function EntryLink({ to, email, invitation, className, children }: EntryLinkProps) {
  const state: EntryState = { email, ...(invitation ? { invitation } : {}) };
  return (
    <Link className={className} to={to} state={state}>
      {children}
    </Link>
  );
}
