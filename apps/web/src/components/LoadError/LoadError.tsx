import { Button } from "../Button/Button";
import { InlineAlert } from "../InlineAlert/InlineAlert";
import { loadErrorMessages } from "./loadErrorMessages";

/** Stan „Error — wczytanie”: komunikat błędu i ponowienie (SC-05, SC-06). */
export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <>
      <InlineAlert tone="error">{text}</InlineAlert>
      <Button writes={false} variant="secondary" onClick={onRetry}>
        {loadErrorMessages.retry}
      </Button>
    </>
  );
}
