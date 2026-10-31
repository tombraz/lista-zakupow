import type { UseMutationResult } from "@tanstack/react-query";
import { asRequestError } from "../../api/client";
import { saveErrorText } from "./messages";

/** ConfirmDialog SC-06 nad zapisem: wskaźnik, błąd zapisu w oknie, potwierdzenie wysyła. */
export function confirmMutation<T>(mutation: UseMutationResult<T, Error, void>) {
  return {
    pending: mutation.isPending,
    error: mutation.error && saveErrorText(asRequestError(mutation.error).code),
    onConfirm: () => {
      mutation.mutate();
    },
  };
}
