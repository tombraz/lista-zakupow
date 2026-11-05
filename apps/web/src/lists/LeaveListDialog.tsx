import type { ListDetails } from "@lista/shared";
import type { RefObject } from "react";
import { asRequestError, type RequestErrorCode } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { errorText } from "../errorText";
import { useLeaveList } from "./useLeaveList";

/** Copy SC-07 `leave.*`; SC-06 `menu.leave` prowadzi do tego samego okna („→ jak na SC-07”). */
export const leaveMessages = {
  question: (listName: string) => `Opuścić listę „${listName}”?`,
  consequence: "Żeby wrócić, potrzebujesz nowego zaproszenia.",
  confirm: "Opuść",
  cancel: "Anuluj",
};

// Copy SC-07 `leave.error` (T-080).
export function leaveErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się opuścić listy. Spróbuj ponownie." });
}

interface LeaveListDialogProps {
  list: ListDetails;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}

/**
 * Potwierdzenie wyjścia z listy (F-13) — jedno dla SC-07 i menu SC-06 (T-094).
 * Po sukcesie `useLeaveList` prowadzi na SC-05; błąd zostaje w oknie.
 */
export function LeaveListDialog({ list, onClose, returnFocus }: LeaveListDialogProps) {
  const leave = useLeaveList(list.id);
  return (
    <ConfirmDialog
      question={leaveMessages.question(list.name)}
      consequence={leaveMessages.consequence}
      confirmLabel={leaveMessages.confirm}
      cancelLabel={leaveMessages.cancel}
      pending={leave.isPending}
      error={leave.error && leaveErrorText(asRequestError(leave.error).code)}
      onConfirm={() => {
        leave.mutate();
      }}
      onCancel={onClose}
      returnFocus={returnFocus}
    />
  );
}
