import { healthReadyResponseSchema } from "@lista/shared";

export type ApiStatus = "ready" | "database-down" | "unreachable";

/** Względny adres: web i API pod jednym originem (ADR 0006). */
export async function fetchApiStatus(): Promise<ApiStatus> {
  try {
    const response = await fetch("/health/ready");
    const body = healthReadyResponseSchema.safeParse(await response.json());
    if (!body.success) return "unreachable";
    return body.data.database === "up" ? "ready" : "database-down";
  } catch {
    return "unreachable";
  }
}
