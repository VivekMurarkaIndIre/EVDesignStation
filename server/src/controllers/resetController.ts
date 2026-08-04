import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { ResetService } from "../services/resetService.js";

export function createResetController(resetService: ResetService) {
  return {
    reset: asyncHandler(async (_req: Request, res: Response) => {
      await resetService.reset();
      res.json({ status: "ok" });
    }),
  };
}
