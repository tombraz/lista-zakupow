// ci-test T-002: celowe naruszenie TH-15 (lint ma zatrzymać ci-ok).
export function Danger({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
