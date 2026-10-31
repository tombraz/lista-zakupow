import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { AppBarButton } from "../AppBar/AppBar";
import styles from "./MoreMenu.module.css";

export interface MenuAction {
  label: string;
  onSelect: () => void;
}

interface MoreMenuProps {
  label: string;
  actions: MenuAction[];
  /** Przycisk otwierający; okna wywołane z menu oddają mu fokus po zamknięciu. */
  buttonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Menu „Więcej opcji” na pasku (SC-06): przycisk z `aria-expanded` i lista przycisków
 * (wzorzec disclosure). Esc zamyka i wraca fokusem na przycisk.
 */
export function MoreMenu({ label, actions, buttonRef }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const closeWhenFocusLeaves = (event: FocusEvent) => {
    if (!containerRef.current?.contains(event.relatedTarget)) setOpen(false);
  };
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={styles.menu}>
      <AppBarButton
        ref={buttonRef}
        label={label}
        icon="⋮"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        onKeyDown={closeOnEscape}
        onBlur={closeWhenFocusLeaves}
      />
      {open && (
        <ul id={menuId} className={styles.items}>
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                className={styles.item}
                onKeyDown={closeOnEscape}
                onBlur={closeWhenFocusLeaves}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
