import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { PrivacyPolicy, TermsOfService } from "./documents";
import { messages } from "./messages";
import styles from "./TermsScreen.module.css";

const SECTIONS = [
  { id: "regulamin", title: messages.toc.terms, body: <TermsOfService /> },
  { id: "polityka-prywatnosci", title: messages.toc.privacy, body: <PrivacyPolicy /> },
];

/** SC-04: publiczny, także przed rejestracją (F-01, N-02). */
export function TermsScreen() {
  const titleRef = useEntryFocus();
  return (
    <main className={styles.page}>
      <title>{`${messages.title} · Wspólna lista zakupów`}</title>
      <BackLink />
      <h1 ref={titleRef} className={styles.title} tabIndex={-1}>
        {messages.title}
      </h1>
      <nav aria-label={messages.toc.label}>
        <ul className={styles.toc}>
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={() => {
                  document.getElementById(section.id)?.focus();
                }}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {SECTIONS.map((section) => (
        <Section key={section.id} id={section.id} title={section.title}>
          {section.body}
        </Section>
      ))}
    </main>
  );
}

/**
 * Ekran bez AppBar ustawia fokus sam (WCAG 2.4.3): po wejściu na `h1`, a gdy adres wskazuje sekcję
 * (SC-02 → `#polityka-prywatnosci`), na jej `h2`. Tylko przy montowaniu: link spisu treści zmienia
 * `#` w adresie i nie może oddać fokusu z sekcji na `h1`.
 */
function useEntryFocus() {
  const ref = useRef<HTMLHeadingElement>(null);
  const { hash } = useLocation();
  const [entryHash] = useState(hash);
  useEffect(() => {
    const section = SECTIONS.find((s) => `#${s.id}` === entryHash);
    (section ? document.getElementById(section.id) : ref.current)?.focus();
  }, [entryHash]);
  return ref;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      {/* Cel linku ze spisu treści: przyjmuje fokus (SC-04, „Accessibility”). */}
      <h2 id={id} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** „Wróć” do poprzedniej strony; otwarty w nowej karcie lub wprost — do SC-01. */
function BackLink() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <Link
      to="/logowanie"
      onClick={(event) => {
        if (location.key === "default") return;
        event.preventDefault();
        void navigate(-1);
      }}
    >
      {messages.back}
    </Link>
  );
}
