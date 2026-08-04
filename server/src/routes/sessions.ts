import { Router, type RequestHandler } from "express";
import type { createSessionController } from "../controllers/sessionController.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { sessionIdParamsSchema, startSessionBodySchema } from "../models/schemas.js";

export function createSessionRouter(
  controller: ReturnType<typeof createSessionController>,
  sessionActionRateLimiter: RequestHandler,
): Router {
  const router = Router();

  router.post("/", sessionActionRateLimiter, validateBody(startSessionBodySchema), controller.startSession);
  router.patch(
    "/:id/stop",
    sessionActionRateLimiter,
    validateParams(sessionIdParamsSchema),
    controller.stopSession,
  );
  router.get("/:id", validateParams(sessionIdParamsSchema), controller.getSession);

  return router;
}
