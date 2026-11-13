import type { ListDetails } from "@lista/shared";
import type { RefObject } from "react";
import { asRequestError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { leaveErrorText, leaveMessages } from "./leaveMessages";
import { useLeaveList } from "./useLeaveList";

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
