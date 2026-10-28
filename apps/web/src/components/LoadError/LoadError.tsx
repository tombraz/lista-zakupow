import { Button } from "../Button/Button";
import { InlineAlert } from "../InlineAlert/InlineAlert";

const RETRY = "Spróbuj ponownie";

/** Stan „Error — wczytanie”: komunikat błędu i ponowienie (SC-05, SC-06). */
export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <>
      <InlineAlert tone="error">{text}</InlineAlert>
      <Button variant="secondary" onClick={onRetry}>
        {RETRY}
      </Button>
    </>
  );
}
