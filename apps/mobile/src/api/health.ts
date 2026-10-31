import { healthReadyResponseSchema } from "@lista/shared";
import { apiUrl } from "../config";

export type ApiStatus = "ready" | "database-down" | "unreachable";

/** Stan API i bazy z `/health/ready`; każdy błąd sieci lub nieznana odpowiedź to „unreachable”. */
export async function fetchApiStatus(): Promise<ApiStatus> {
  try {
    const response = await fetch(`${apiUrl()}/health/ready`);
    const body = healthReadyResponseSchema.parse(await response.json());
    return body.database === "up" ? "ready" : "database-down";
  } catch {
    return "unreachable";
  }
}
