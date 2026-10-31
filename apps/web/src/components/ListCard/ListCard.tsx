import type { ListSummary } from "@lista/shared";
import { Link } from "react-router";
import { AvatarStack } from "../Avatar/Avatar";
import styles from "./ListCard.module.css";

export interface ListCardTexts {
  toBuy: (count: number) => string;
  sharedBy: (name: string) => string;
  sharedByLabel: (name: string) => string;
}

/**
 * Karta listy: cały link; nazwa dostępna = nazwa + „udostępniona przez <imię>” +
 * „N do kupienia” (design-system.md, ListCard).
 */
export function ListCard({ list, texts }: { list: ListSummary; texts: ListCardTexts }) {
  const shared = list.role === "participant";
  const toBuy = texts.toBuy(list.toBuyCount);
  const label = [list.name, shared && texts.sharedByLabel(list.owner.name), toBuy]
    .filter(Boolean)
    .join(", ");
  return (
    <Link className={styles.card} to={`/listy/${list.id}`} aria-label={label}>
      <span className={styles.name}>{list.name}</span>
      <span className={styles.meta}>
        <span>{toBuy}</span>
        {shared && <span>{texts.sharedBy(list.owner.name)}</span>}
        <AvatarStack people={list.members} />
      </span>
    </Link>
  );
}
