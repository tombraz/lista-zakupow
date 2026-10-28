import type { InvitationPreview } from "@lista/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { asRequestError, type ApiRequestError } from "../../api/client";
import { acceptInvitation, previewInvitation } from "../../api/invitations";
import type { JoinedState } from "../../invitations/invitationContext";
import { LISTS_KEY } from "../../lists/useLists";

/** Co pokazuje SC-08 (sekcja „States”). */
export type InvitationView =
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "failed"; error: ApiRequestError }
  | { kind: "invite"; preview: InvitationPreview; joinError: ApiRequestError | null };

/** Podgląd linku i dołączenie; po dołączeniu SC-06, a SC-08 znika z historii (TH-08). */
export function useInvitation(token: string) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => previewInvitation(token),
  });
  const join = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: async ({ listId }) => {
      void client.invalidateQueries({ queryKey: LISTS_KEY });
      const state: JoinedState = { joined: preview.data?.listName ?? "" };
      await navigate(`/listy/${listId}`, { replace: true, state });
    },
  });
  return { view: viewOf(preview, join.error), join };
}

function viewOf(
  preview: ReturnType<typeof useQuery<InvitationPreview>>,
  joinFailure: Error | null,
): InvitationView {
  const previewError = preview.error ? asRequestError(preview.error) : null;
  const joinError = joinFailure ? asRequestError(joinFailure) : null;
  // MC-02: link nieważny przy podglądzie albo w chwili dołączenia — bez treści listy.
  if (previewError?.code === "invitation_invalid" || joinError?.code === "invitation_invalid") {
    return { kind: "invalid" };
  }
  if (previewError) return { kind: "failed", error: previewError };
  if (!preview.data) return { kind: "checking" };
  return { kind: "invite", preview: preview.data, joinError };
}
