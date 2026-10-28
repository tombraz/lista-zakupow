import type { ListSummary } from "@lista/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { RequestErrorCode } from "../../api/client";
import { createList } from "../../api/lists";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { Button } from "../../components/Button/Button";
import { useListNameForm } from "../../lists/listName";
import { ListNameField } from "../../lists/ListNameField";
import { LISTS_KEY } from "../../lists/useLists";
import { createErrorText, messages } from "./messages";
import styles from "./ListsScreen.module.css";

/** Formularz nowej listy w miejscu przycisku; po utworzeniu SC-06 nowej listy. */
interface NewListFormProps {
  onCancel: () => void;
  onLimitReached: () => void;
}

export function NewListForm({ onCancel, onLimitReached }: NewListFormProps) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const form = useListNameForm({
    save: createList,
    onSaved: (list: ListSummary) => {
      void client.invalidateQueries({ queryKey: LISTS_KEY });
      void navigate(`/listy/${list.id}`);
    },
    onFailure: (code) => {
      if (code === "limit_reached") onLimitReached();
      else setFailure(code);
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") onCancel();
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      {failure && <InlineAlert tone="error">{createErrorText(failure)}</InlineAlert>}
      <ListNameField
        ref={inputRef}
        onKeyDown={closeOnEscape}
        label={messages.new.label}
        placeholder={messages.new.placeholder}
        state={form}
      />
      <Button type="submit" loading={form.pending} onKeyDown={closeOnEscape}>
        {messages.new.submit}
      </Button>
      <Button variant="secondary" onClick={onCancel} onKeyDown={closeOnEscape}>
        {messages.cancel}
      </Button>
    </form>
  );
}
