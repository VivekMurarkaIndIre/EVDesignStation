import type { RateSchedule } from "../models/index.js";
import type { SessionRepository } from "../repositories/SessionRepository.js";
import type { StationRepository } from "../repositories/StationRepository.js";
import type { WalletRepository } from "../repositories/WalletRepository.js";
import { calculateCost } from "./pricingService.js";
import type { SessionService } from "./sessionService.js";

export interface SessionMonitor {
  start(): void;
  stop(): void;
  /** Runs one check pass immediately. Exposed mainly so tests can drive it directly instead of racing real timers. */
  tick(): Promise<void>;
}

/**
 * Periodically checks every active session and auto-stops it if either:
 *  - the wallet's single shared balance has been consumed by the combined
 *    cost-so-far of every active session (not just this one — see below), or
 *  - the session's chosen auto-stop duration has elapsed.
 *
 * The wallet has no per-session allocation, so once the combined spend of
 * all active sessions reaches the balance, none of them can legitimately
 * keep drawing on it — this stops every active session in that case, not
 * only whichever one happened to tip it over.
 *
 * This is the only place in the app that stops a session without a direct
 * user request, so it goes through the same sessionService.stopSession used
 * by the manual stop endpoint.
 */
export function createSessionMonitor(deps: {
  sessionRepository: SessionRepository;
  stationRepository: StationRepository;
  walletRepository: WalletRepository;
  sessionService: SessionService;
  rateSchedule: RateSchedule;
  now?: () => Date;
  intervalMs?: number;
}): SessionMonitor {
  const {
    sessionRepository,
    stationRepository,
    walletRepository,
    sessionService,
    rateSchedule,
    now = () => new Date(),
    intervalMs = 5000,
  } = deps;

  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick(): Promise<void> {
    const [activeSessions, wallet] = await Promise.all([sessionRepository.findActive(), walletRepository.getWallet()]);
    const nowDate = now();

    const withCostSoFar = [];
    for (const session of activeSessions) {
      const station = await stationRepository.findById(session.stationId);
      if (!station) {
        continue;
      }
      const costSoFar = calculateCost(new Date(session.startTime), nowDate, station.chargingSpeedKw, rateSchedule).totalCost;
      withCostSoFar.push({ session, costSoFar });
    }

    const combinedCostSoFar = withCostSoFar.reduce((sum, { costSoFar }) => sum + costSoFar, 0);
    const balanceDepleted = wallet.balance - combinedCostSoFar <= 0;

    for (const { session } of withCostSoFar) {
      try {
        if (balanceDepleted) {
          await sessionService.stopSession(session.id, "insufficient_funds");
        } else if (session.autoStopAt && nowDate >= new Date(session.autoStopAt)) {
          await sessionService.stopSession(session.id, "duration_elapsed");
        }
      } catch {
        // Benign race: the session may already have been stopped (manually,
        // or by this same loop on a prior tick) between findActive() and
        // this call — stopSession's own "already stopped" guard is the
        // source of truth, so there's nothing more to do here.
      }
    }
  }

  return {
    start() {
      if (timer) {
        return;
      }
      timer = setInterval(() => {
        tick().catch((err) => console.error("sessionMonitor tick failed:", err));
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    tick,
  };
}
