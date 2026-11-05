import type { ListDetails } from "@lista/shared";
import { useRef, useState } from "react";
import { Button } from "../../components/Button/Button";
import { LeaveListDialog } from "../../lists/LeaveListDialog";
import { messages } from "./messages";

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
