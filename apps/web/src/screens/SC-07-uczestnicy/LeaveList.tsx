import type { ListDetails } from "@lista/shared";
import { useRef, useState } from "react";
import { asRequestError } from "../../api/client";
import { Button } from "../../components/Button/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { leaveErrorText, messages } from "./messages";
import { useLeaveList } from "./useLeaveList";

/** SC-07 uczestnika: „Opuść listę” po potwierdzeniu (F-13); błąd zapisu w oknie, które zostaje. */
export function LeaveList({ list }: { list: ListDetails }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const leave = useLeaveList(list.id);

  return (
    <>
      <Button
        ref={trigger}
        variant="danger"
        writes
        onClick={() => {
          leave.reset();
          setConfirming(true);
        }}
      >
        {messages.leave.action}
      </Button>
      {confirming && (
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
          onCancel={() => {
            setConfirming(false);
          }}
          returnFocus={trigger}
        />
      )}
    </>
  );
}
