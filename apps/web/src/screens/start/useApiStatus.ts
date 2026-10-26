import { useQuery } from "@tanstack/react-query";
import { fetchApiStatus } from "../../api/health";

export function useApiStatus() {
  return useQuery({ queryKey: ["health", "ready"], queryFn: fetchApiStatus });
}
