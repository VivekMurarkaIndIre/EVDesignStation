import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { StationService } from "../services/stationService.js";

export function createStationController(stationService: StationService) {
  return {
    listStations: asyncHandler(async (_req: Request, res: Response) => {
      const stations = await stationService.listStations();
      res.json(stations);
    }),
  };
}
