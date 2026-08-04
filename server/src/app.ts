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
import { createResetController } from "./controllers/resetController.js";
import { createSessionController } from "./controllers/sessionController.js";
import { createStationController } from "./controllers/stationController.js";
import { createWalletController } from "./controllers/walletController.js";
import { createResetRouter } from "./routes/reset.js";
import { createSessionRouter } from "./routes/sessions.js";
import { createStationRouter } from "./routes/stations.js";
import { createWalletRouter } from "./routes/wallet.js";
import { createResetService } from "./services/resetService.js";
import { createSessionService, type SessionService } from "./services/sessionService.js";
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

/** Shape of app.locals.deps — lets the server entrypoint build a sessionMonitor from the same instances createApp wired up, without createApp starting a live timer itself (see note below). */
export interface AppLocals {
  sessionRepository: SessionRepository;
  stationRepository: StationRepository;
  walletRepository: WalletRepository;
  sessionService: SessionService;
  rateSchedule: RateSchedule;
  now: () => Date;
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
  const resetService = createResetService({
    stationRepository,
    sessionRepository,
    walletRepository,
    initialWalletBalance: INITIAL_WALLET_BALANCE,
    initialWalletBalanceNote: INITIAL_WALLET_BALANCE_NOTE,
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

  // Static config, not a resource with its own CRUD lifecycle — exposed
  // read-only so the client can estimate a session's cost for a chosen
  // duration before starting it, using the same peak/off-peak rule the
  // server bills with (see pricingService.currentRatePerKwh).
  app.get("/rate-schedule", (_req, res) => {
    res.json(rateSchedule);
  });

  app.use("/stations", createStationRouter(createStationController(stationService)));
  app.use("/sessions", createSessionRouter(createSessionController(sessionService), sessionActionRateLimiter));
  app.use("/wallet", createWalletRouter(createWalletController(walletService)));
  app.use("/reset", createResetRouter(createResetController(resetService), sessionActionRateLimiter));

  app.use(notFoundHandler);
  app.use(errorHandler);

  // Exposed so the server entrypoint can start a sessionMonitor against the
  // exact same repositories/service this app uses, without createApp itself
  // starting a live setInterval — tests call createApp() directly, many
  // times, with no teardown, and would otherwise leak timers.
  const locals: AppLocals = { sessionRepository, stationRepository, walletRepository, sessionService, rateSchedule, now };
  app.locals.deps = locals;

  return app;
}
