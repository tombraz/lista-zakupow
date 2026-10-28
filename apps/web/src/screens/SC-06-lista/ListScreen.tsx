import type { ListDetails } from "@lista/shared";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { AppBar } from "../../components/AppBar/AppBar";
import { LoadError } from "../../components/LoadError/LoadError";
import { MoreMenu } from "../../components/MoreMenu/MoreMenu";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useList } from "../../lists/useList";
import { AddItemBar } from "./AddItemBar";
import { DeleteListDialog } from "./DeleteListDialog";
import { Items } from "./Items";
import styles from "./ListScreen.module.css";
import { messages } from "./messages";
import { RenameSheet } from "./RenameSheet";
import { useAddItem } from "./useAddItem";

const BACK = { to: "/listy", label: messages.back };

/** SC-06: pozycje do kupienia, dodawanie i edycja; menu właściciela. */
export function ListScreen() {
  const { listId = "" } = useParams();
  const list = useList(listId);
  if (list.noAccess) return <NoAccess />;

  return (
    <div className={styles.screen}>
      <ListBar list={list.data} />
      <ListBody listId={listId} list={list} />
    </div>
  );
}

function ListBar({ list }: { list: ListDetails | undefined }) {
  return (
    <AppBar
      title={list?.name ?? ""}
      back={BACK}
      actions={list?.role === "owner" && <OwnerMenu list={list} />}
    />
  );
}

function ListBody({ listId, list }: { listId: string; list: ReturnType<typeof useList> }) {
  const adding = useAddItem(listId, list.data?.items);
  return (
    <>
      <main className={styles.page} aria-busy={list.isPending || undefined}>
        {list.isPending && <Skeleton rows={5} variant="row" />}
        {list.isError && (
          <LoadError
            text={messages.loadError}
            onRetry={() => {
              void list.refetch();
            }}
          />
        )}
        {list.data && <Items list={list.data} addNameRef={adding.nameRef} />}
        <p className={styles.visuallyHidden} role="status">
          {adding.announcement}
        </p>
      </main>
      {/* Loading: AddBar nieaktywny, dopóki lista nie jest wczytana. */}
      <AddItemBar state={adding} disabled={!list.data} />
    </>
  );
}

/** MC-01: cudza lista wygląda jak nieistniejąca — bez nazwy i treści. */
function NoAccess() {
  return (
    <>
      <AppBar title={messages.noAccess} back={BACK} />
      <main className={styles.page}>
        <Link to="/listy">{messages.backToLists}</Link>
      </main>
    </>
  );
}

/** F-05: zmiana nazwy i usunięcie tylko dla właściciela (SEC2). */
function OwnerMenu({ list }: { list: ListDetails }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<"rename" | "delete" | null>(null);
  const close = () => {
    setOpen(null);
  };
  return (
    <>
      <MoreMenu
        label={messages.more}
        buttonRef={buttonRef}
        actions={[
          {
            label: messages.menu.rename,
            onSelect: () => {
              setOpen("rename");
            },
          },
          {
            label: messages.menu.delete,
            onSelect: () => {
              setOpen("delete");
            },
          },
        ]}
      />
      {open === "rename" && <RenameSheet list={list} onClose={close} returnFocus={buttonRef} />}
      {open === "delete" && (
        <DeleteListDialog list={list} onClose={close} returnFocus={buttonRef} />
      )}
    </>
  );
}
