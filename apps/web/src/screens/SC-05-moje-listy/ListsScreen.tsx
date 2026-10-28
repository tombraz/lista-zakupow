import { AppBar, AppBarLink } from "../../components/AppBar/AppBar";
import { Button } from "../../components/Button/Button";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { ListCard } from "../../components/ListCard/ListCard";
import { LoadError } from "../../components/LoadError/LoadError";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useLists } from "../../lists/useLists";
import styles from "./ListsScreen.module.css";
import { messages } from "./messages";
import { NewListForm } from "./NewListForm";
import { useNewList } from "./useNewList";

export function ListsScreen() {
  const lists = useLists();
  const newList = useNewList(lists.data);

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
      </main>
    </>
  );
}
