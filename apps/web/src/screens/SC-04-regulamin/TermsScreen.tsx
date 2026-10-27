import type { ReactNode } from "react";
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
  return (
    <main className={styles.page}>
      <title>{`${messages.title} · Wspólna lista zakupów`}</title>
      <BackLink />
      <h1 className={styles.title}>{messages.title}</h1>
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
