import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useConnection } from "../../live/useConnection";
import { AppBarButton } from "../AppBar/AppBar";
import { OFFLINE_BANNER_ID } from "../OfflineBanner/OfflineBanner";
import styles from "./MoreMenu.module.css";

export interface MenuAction {
  label: string;
  onSelect: () => void;
  /**
   * Akcja prowadząca do zapisu: bez połączenia nieaktywna, jak `Button` z `writes` (T-063).
   * Wymagane, żeby każda pozycja jawnie decydowała o działaniu bez połączenia (T-112).
   */
  writes: boolean;
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
  const { online } = useConnection();

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
          {actions.map((action) => {
            const offline = action.writes && !online;
            return (
              <li key={action.label}>
                <button
                  type="button"
                  className={styles.item}
                  aria-disabled={offline || undefined}
                  aria-describedby={offline ? OFFLINE_BANNER_ID : undefined}
                  onKeyDown={closeOnEscape}
                  onBlur={closeWhenFocusLeaves}
                  onClick={() => {
                    if (offline) return;
                    setOpen(false);
                    action.onSelect();
                  }}
                >
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
