import { useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import { clearChecked } from "../../api/items";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { confirmMutation } from "./confirmMutation";
import { removeItems } from "./itemsCache";
import { messages } from "./messages";
import { useGuardedMutation } from "../../api/useGuardedMutation";

interface ClearBoughtDialogProps {
  listId: string;
  count: number;
  onClose: () => void;
  /** Po usunięciu (przycisk wywołujący znika razem z sekcją). */
  onCleared: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}

/** F-08: „Usuń wszystkie kupione” po potwierdzeniu; z cache znika to, co usunęło API. */
export function ClearBoughtDialog(props: ClearBoughtDialogProps) {
  const { listId, count, onClose, onCleared, returnFocus } = props;
  const client = useQueryClient();
  const mutation = useGuardedMutation({
    mutationFn: () => clearChecked(listId),
    onSuccess: ({ deletedIds }) => {
      removeItems(client, listId, deletedIds);
      onClose();
      onCleared();
    },
  });

  return (
    <ConfirmDialog
      question={messages.clearBought.question(count)}
      consequence={messages.clearBought.consequence}
      confirmLabel={messages.clearBought.confirm}
      cancelLabel={messages.cancel}
      {...confirmMutation(mutation)}
      onCancel={onClose}
      returnFocus={returnFocus}
    />
  );
}
