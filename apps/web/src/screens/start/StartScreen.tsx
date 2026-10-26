import { messages } from "./messages";
import styles from "./StartScreen.module.css";
import { useApiStatus } from "./useApiStatus";

export function StartScreen() {
  const { data: status } = useApiStatus();

  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>{messages.title}</h1>
      <p className={styles.status} role="status">
        {status ? messages.status[status] : messages.checking}
      </p>
    </main>
  );
}
