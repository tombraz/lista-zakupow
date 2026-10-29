import type { ListDetails } from "@lista/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import { useNavigate } from "react-router";
import { deleteList } from "../../api/lists";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { confirmMutation } from "./confirmMutation";
import { deleteListKey } from "../../lists/deleteListKey";
import { listKey } from "../../lists/useList";
import { LISTS_KEY } from "../../lists/useLists";
import { deleteConsequence, messages } from "./messages";

interface DeleteListDialogProps {
  list: ListDetails;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}

/** F-05: usunięcie listy po potwierdzeniu; potem SC-05. */
export function DeleteListDialog({ list, onClose, returnFocus }: DeleteListDialogProps) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationKey: deleteListKey(list.id),
    mutationFn: () => deleteList(list.id),
    onSuccess: () => {
      client.removeQueries({ queryKey: listKey(list.id) });
      void client.invalidateQueries({ queryKey: LISTS_KEY });
      void navigate("/listy", { replace: true });
    },
  });

  return (
    <ConfirmDialog
      question={messages.delete.question(list.name)}
      consequence={deleteConsequence(list.members.length)}
      confirmLabel={messages.delete.confirm}
      cancelLabel={messages.cancel}
      {...confirmMutation(mutation)}
      onCancel={onClose}
      returnFocus={returnFocus}
    />
  );
}
