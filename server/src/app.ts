import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import { config } from "./config.js";
import type { RateSchedule } from "./models/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createSessionActionRateLimiter } from "./middleware/rateLimiter.js";
import { InMemorySessionRepository } from "./repositories/InMemorySessionRepository.js";
import { InMemoryStationRepository } from "./repositories/InMemoryStationRepository.js";
import { InMemoryWalletRepository } from "./repositories/InMemoryWalletRepository.js";
import { INITIAL_WALLET_BALANCE, INITIAL_WALLET_BALANCE_NOTE, RATE_SCHEDULE } from "./repositories/seed-data.js";
import type { SessionRepository } from "./repositories/SessionRepository.js";
import type { StationRepository } from "./repositories/StationRepository.js";
import type { WalletRepository } from "./repositories/WalletRepository.js";
import { createSessionController } from "./controllers/sessionController.js";
import { createStationController } from "./controllers/stationController.js";
import { createWalletController } from "./controllers/walletController.js";
import { createSessionRouter } from "./routes/sessions.js";
import { createStationRouter } from "./routes/stations.js";
import { createWalletRouter } from "./routes/wallet.js";
import { createSessionService } from "./services/sessionService.js";
import { createStationService } from "./services/stationService.js";
import { createWalletService } from "./services/walletService.js";

export interface AppDependencies {
  stationRepository: StationRepository;
  sessionRepository: SessionRepository;
  walletRepository: WalletRepository;
  rateSchedule: RateSchedule;
  now: () => Date;
  sessionActionRateLimiter: RequestHandler;
}

export function createApp(deps: Partial<AppDependencies> = {}) {
  const stationRepository = deps.stationRepository ?? new InMemoryStationRepository();
  const sessionRepository = deps.sessionRepository ?? new InMemorySessionRepository();
  const walletRepository =
    deps.walletRepository ?? new InMemoryWalletRepository(INITIAL_WALLET_BALANCE, INITIAL_WALLET_BALANCE_NOTE);
  const rateSchedule = deps.rateSchedule ?? RATE_SCHEDULE;
  const now = deps.now ?? (() => new Date());
  const sessionActionRateLimiter = deps.sessionActionRateLimiter ?? createSessionActionRateLimiter();

  const stationService = createStationService({ stationRepository });
  const walletService = createWalletService({ walletRepository });
  const sessionService = createSessionService({
    sessionRepository,
    stationRepository,
    walletRepository,
    rateSchedule,
    now,
  });

  const app = express();

  // Render/Railway sit behind a reverse proxy; without this, express-rate-limit
  // would key off the proxy's IP for every client instead of the real one.
  if (config.isProduction) {
    app.set("trust proxy", 1);
  }

  // The API's responses are meant to be fetched cross-origin by the deployed
  // frontend, so the default same-origin resource policy has to be relaxed.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/stations", createStationRouter(createStationController(stationService)));
  app.use("/sessions", createSessionRouter(createSessionController(sessionService), sessionActionRateLimiter));
  app.use("/wallet", createWalletRouter(createWalletController(walletService)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
