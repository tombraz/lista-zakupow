import { useQuery } from "@tanstack/react-query";
import { fetchApiStatus } from "../../api/health";

const RECHECK_MS = 5000;

/** Stan serwera; dopóki nie jest „ready”, sprawdzany ponownie (api może wystartować później). */
export function useApiStatus() {
  return useQuery({
    queryKey: ["health", "ready"],
    queryFn: fetchApiStatus,
    refetchInterval: (query) => (query.state.data === "ready" ? false : RECHECK_MS),
  });
}
