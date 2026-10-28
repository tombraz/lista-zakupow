import type { ListDetails } from "@lista/shared";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { AppBar } from "../../components/AppBar/AppBar";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { LoadError } from "../../components/LoadError/LoadError";
import { MoreMenu } from "../../components/MoreMenu/MoreMenu";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useList } from "../../lists/useList";
import styles from "./ListScreen.module.css";
import { messages } from "./messages";
import { DeleteListDialog } from "./DeleteListDialog";
import { RenameSheet } from "./RenameSheet";

const BACK = { to: "/listy", label: messages.back };

/** SC-06 w zakresie T-005: nagłówek, pusty stan, menu właściciela; pozycje w T-006. */
export function ListScreen() {
  const { listId = "" } = useParams();
  const list = useList(listId);
  if (list.noAccess) return <NoAccess />;

  return (
    <>
      <ListBar list={list.data} />
      <ListBody list={list} />
    </>
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

function ListBody({ list }: { list: ReturnType<typeof useList> }) {
  return (
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
      {list.data?.items.length === 0 && <EmptyState text={messages.empty} />}
    </main>
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
