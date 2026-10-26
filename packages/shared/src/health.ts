import { z } from "zod";

export const healthReadyResponseSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
  database: z.enum(["up", "down"]),
});

export type HealthReadyResponse = z.infer<typeof healthReadyResponseSchema>;
