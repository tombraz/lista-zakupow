import type { Item } from "@lista/shared";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "../../components/Button/Button";
import { ClearBoughtDialog } from "./ClearBoughtDialog";
import styles from "./ListScreen.module.css";
import { messages } from "./messages";

interface BoughtSectionProps {
  listId: string;
  /** Odhaczone pozycje, od ostatnio odhaczonej. */
  items: Item[];
  open: boolean;
  onToggle: () => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
  /** Po usunięciu kupionych: sekcja znika, fokus przenosi wołający. */
  onCleared: () => void;
  /** Wiersze odhaczonych pozycji. */
  children: ReactNode;
}

/** CollapsibleSection „Kupione (N)” (design-system.md): domyślnie zwinięta. */
export function BoughtSection(props: BoughtSectionProps) {
  const { listId, items, open, onToggle, toggleRef, onCleared, children } = props;
  const clearRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <section className={styles.bought}>
      <h2 className={styles.boughtHeading}>
        <button
          ref={toggleRef}
          type="button"
          className={styles.boughtToggle}
          aria-expanded={open}
          onClick={onToggle}
        >
          {messages.bought(items.length)}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </h2>
      {open && (
        <>
          <ul className={styles.items} aria-label={messages.boughtHeading}>
            {children}
          </ul>
          <Button
            ref={clearRef}
            variant="danger"
            onClick={() => {
              setConfirming(true);
            }}
          >
            {messages.clearBought.open}
          </Button>
        </>
      )}
      {confirming && (
        <ClearBoughtDialog
          listId={listId}
          count={items.length}
          onClose={() => {
            setConfirming(false);
          }}
          onCleared={onCleared}
          returnFocus={clearRef}
        />
      )}
    </section>
  );
}
