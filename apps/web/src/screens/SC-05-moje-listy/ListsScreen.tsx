import { useLocation } from "react-router";
import { AppBar, AppBarLink } from "../../components/AppBar/AppBar";
import { Button } from "../../components/Button/Button";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { ListCard } from "../../components/ListCard/ListCard";
import { LoadError } from "../../components/LoadError/LoadError";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useLists } from "../../lists/useLists";
import type { RemovedListState } from "../../live/useLiveList";
import { useNewListAnnouncement } from "./useNewListAnnouncement";
import styles from "./ListsScreen.module.css";
import { messages } from "./messages";
import { NewListForm } from "./NewListForm";
import { useNewList } from "./useNewList";

export function ListsScreen() {
  const lists = useLists();
  const newList = useNewList(lists.data);
  const announcement = useNewListAnnouncement(lists.data);

  const trigger = (label: string) =>
    newList.open ? (
      <NewListForm onCancel={newList.cancel} onLimitReached={newList.refusedByLimit} />
    ) : (
      <Button ref={newList.triggerRef} disabled={newList.limitReached} onClick={newList.show}>
        {label}
      </Button>
    );

  return (
    <>
      <AppBar
        title={messages.title}
        actions={<AppBarLink to="/konto" label={messages.account} icon="👤" />}
      />
      <main className={styles.page} aria-busy={lists.isPending || undefined}>
        <RemovedNotice />
        {lists.isPending && <Skeleton rows={3} variant="card" />}
        {lists.isError && (
          <LoadError
            text={messages.loadError}
            onRetry={() => {
              void lists.refetch();
            }}
          />
        )}
        {lists.data?.length === 0 && (
          <EmptyState text={messages.empty.text} action={trigger(messages.empty.cta)} />
        )}
        {lists.data && lists.data.length > 0 && (
          <>
            <ul className={styles.cards}>
              {lists.data.map((list) => (
                <li key={list.id}>
                  <ListCard list={list} texts={messages.card} />
                </li>
              ))}
            </ul>
            {newList.limitReached && <InlineAlert tone="warning">{messages.limit}</InlineAlert>}
            {trigger(messages.new.open)}
          </>
        )}
        <p className={styles.visuallyHidden} role="status">
          {announcement}
        </p>
      </main>
    </>
  );
}

/** SC-05 „Info — usunięto dostęp”: powrót z SC-06 / SC-07 po usunięciu listy (F-14, MC-03). */
function RemovedNotice() {
  const state = useLocation().state as Partial<RemovedListState> | null;
  const name = state?.removedList;
  return typeof name === "string" ? (
    <InlineAlert tone="info">{messages.removed(name)}</InlineAlert>
  ) : null;
}
