import { z } from "zod";

export const startSessionBodySchema = z.object({
  stationId: z.string().min(1, "stationId is required"),
});
export type StartSessionBody = z.infer<typeof startSessionBodySchema>;

export const sessionIdParamsSchema = z.object({
  id: z.string().min(1, "id is required"),
});
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;
