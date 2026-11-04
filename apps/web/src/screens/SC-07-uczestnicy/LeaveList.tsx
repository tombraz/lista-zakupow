import type { ListDetails } from "@lista/shared";
import { useRef, useState, type RefObject } from "react";
import { asRequestError } from "../../api/client";
import { Button } from "../../components/Button/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { leaveErrorText, messages } from "./messages";
import { useLeaveList } from "./useLeaveList";

/** SC-07 uczestnika: „Opuść listę” po potwierdzeniu (F-13); błąd zapisu w oknie, które zostaje. */
export function LeaveList({ list }: { list: ListDetails }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        ref={trigger}
        variant="danger"
        writes
        onClick={() => {
          setConfirming(true);
        }}
      >
        {messages.leave.action}
      </Button>
      {confirming && (
        <LeaveListDialog
          list={list}
          onClose={() => {
            setConfirming(false);
          }}
          returnFocus={trigger}
        />
      )}
    </>
  );
}

interface LeaveListDialogProps {
  list: ListDetails;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}

/**
 * Potwierdzenie wyjścia z listy — jedno dla SC-07 i menu SC-06 („→ jak na SC-07”, T-094).
 * Po sukcesie `useLeaveList` prowadzi na SC-05; błąd zostaje w oknie.
 */
export function LeaveListDialog({ list, onClose, returnFocus }: LeaveListDialogProps) {
  const leave = useLeaveList(list.id);
  return (
    <ConfirmDialog
      question={messages.leave.question(list.name)}
      consequence={messages.leave.consequence}
      confirmLabel={messages.leave.confirm}
      cancelLabel={messages.cancel}
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
