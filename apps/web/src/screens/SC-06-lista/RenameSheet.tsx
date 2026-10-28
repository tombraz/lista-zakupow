import type { ListDetails, ListSummary } from "@lista/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type RefObject } from "react";
import type { RequestErrorCode } from "../../api/client";
import { renameList } from "../../api/lists";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { Modal } from "../../components/Modal/Modal";
import { useListNameForm } from "../../lists/listName";
import { ListNameField } from "../../lists/ListNameField";
import { listKey } from "../../lists/useList";
import { LISTS_KEY } from "../../lists/useLists";
import styles from "./ListScreen.module.css";
import { messages, saveErrorText } from "./messages";

interface RenameSheetProps {
  list: ListDetails;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}

/** Arkusz „Zmień nazwę listy” (SC-06, F-05); nowa nazwa w pasku i na SC-05. */
export function RenameSheet({ list, onClose, returnFocus }: RenameSheetProps) {
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const form = useListNameForm({
    initial: list.name,
    save: (name) => renameList(list.id, name),
    onSaved: (renamed: ListSummary) => {
      client.setQueryData<ListDetails>(listKey(list.id), (current) =>
        current ? { ...current, name: renamed.name } : current,
      );
      void client.invalidateQueries({ queryKey: LISTS_KEY });
      onClose();
    },
    onFailure: setFailure,
  });

  return (
    <Modal
      role="dialog"
      variant="sheet"
      title={messages.rename.title}
      onClose={onClose}
      initialFocus={inputRef}
      returnFocus={returnFocus}
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        {failure && <InlineAlert tone="error">{saveErrorText(failure)}</InlineAlert>}
        <ListNameField ref={inputRef} label={messages.rename.label} state={form} />
        <Button type="submit" loading={form.pending}>
          {messages.rename.save}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {messages.cancel}
        </Button>
      </form>
    </Modal>
  );
}
