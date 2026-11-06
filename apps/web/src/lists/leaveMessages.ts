import type { RequestErrorCode } from "../api/client";
import { errorText } from "../errorText";

/** Copy SC-07 i SC-06 `leave.confirm.*`, `cancel`: okno „Opuść listę” (F-13, T-094, T-103). */
export const leaveMessages = {
  question: (listName: string) => `Opuścić listę „${listName}”?`,
  consequence: "Żeby wrócić, potrzebujesz nowego zaproszenia.",
  confirm: "Opuść",
  cancel: "Anuluj",
};

/** Copy SC-07 i SC-06 `leave.error` (T-080). */
export function leaveErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się opuścić listy. Spróbuj ponownie." });
}
