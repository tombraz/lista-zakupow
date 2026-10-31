import styles from "./Skeleton.module.css";

/** Szkielet wierszy na czas ładowania (design-system.md, Loading); ukryty przed czytnikiem. */
export function Skeleton({ rows, variant }: { rows: number; variant: "card" | "row" }) {
  return (
    <ul className={styles.skeleton} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className={styles[variant]} data-skeleton />
      ))}
    </ul>
  );
}
