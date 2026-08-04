import { Router } from "express";
import type { createStationController } from "../controllers/stationController.js";

export function createStationRouter(controller: ReturnType<typeof createStationController>): Router {
  const router = Router();
  router.get("/", controller.listStations);
  return router;
}
