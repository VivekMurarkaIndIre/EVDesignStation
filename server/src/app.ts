import cors from "cors";
import express, { type RequestHandler } from "express";
import type { RateSchedule } from "./models/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createSessionActionRateLimiter } from "./middleware/rateLimiter.js";
import { InMemorySessionRepository } from "./repositories/InMemorySessionRepository.js";
import { InMemoryStationRepository } from "./repositories/InMemoryStationRepository.js";
import { RATE_SCHEDULE } from "./repositories/seed-data.js";
import type { SessionRepository } from "./repositories/SessionRepository.js";
import type { StationRepository } from "./repositories/StationRepository.js";
import { createSessionController } from "./controllers/sessionController.js";
import { createStationController } from "./controllers/stationController.js";
import { createSessionRouter } from "./routes/sessions.js";
import { createStationRouter } from "./routes/stations.js";
import { createSessionService } from "./services/sessionService.js";
import { createStationService } from "./services/stationService.js";

export interface AppDependencies {
  stationRepository: StationRepository;
  sessionRepository: SessionRepository;
  rateSchedule: RateSchedule;
  now: () => Date;
  sessionActionRateLimiter: RequestHandler;
}

export function createApp(deps: Partial<AppDependencies> = {}) {
  const stationRepository = deps.stationRepository ?? new InMemoryStationRepository();
  const sessionRepository = deps.sessionRepository ?? new InMemorySessionRepository();
  const rateSchedule = deps.rateSchedule ?? RATE_SCHEDULE;
  const now = deps.now ?? (() => new Date());
  const sessionActionRateLimiter = deps.sessionActionRateLimiter ?? createSessionActionRateLimiter();

  const stationService = createStationService({ stationRepository });
  const sessionService = createSessionService({ sessionRepository, stationRepository, rateSchedule, now });

  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/stations", createStationRouter(createStationController(stationService)));
  app.use("/sessions", createSessionRouter(createSessionController(sessionService), sessionActionRateLimiter));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
