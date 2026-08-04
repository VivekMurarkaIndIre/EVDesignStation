import { Router, type RequestHandler } from "express";
import type { createResetController } from "../controllers/resetController.js";

export function createResetRouter(
  controller: ReturnType<typeof createResetController>,
  resetRateLimiter: RequestHandler,
): Router {
  const router = Router();
  router.post("/", resetRateLimiter, controller.reset);
  return router;
}
