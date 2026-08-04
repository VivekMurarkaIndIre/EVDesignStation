import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { SessionService } from "../services/sessionService.js";
import type { SessionIdParams, StartSessionBody } from "../models/schemas.js";

export function createSessionController(sessionService: SessionService) {
  return {
    startSession: asyncHandler(async (req: Request, res: Response) => {
      const { stationId, autoStopAfterMinutes } = req.body as StartSessionBody;
      const session = await sessionService.startSession(stationId, autoStopAfterMinutes);
      res.status(201).json(session);
    }),

    stopSession: asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as unknown as SessionIdParams;
      const session = await sessionService.stopSession(id);
      res.json(session);
    }),

    getSession: asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as unknown as SessionIdParams;
      const session = await sessionService.getSession(id);
      res.json(session);
    }),
  };
}
