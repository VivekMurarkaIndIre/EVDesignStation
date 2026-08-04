import { randomUUID } from "node:crypto";
import type { RateSchedule, Session, StopReason } from "../models/index.js";
import { ConflictError, InsufficientFundsError, NotFoundError } from "../middleware/errors.js";
import type { SessionRepository } from "../repositories/SessionRepository.js";
import type { StationRepository } from "../repositories/StationRepository.js";
import type { WalletRepository } from "../repositories/WalletRepository.js";
import { calculateCost, currentRatePerKwh, estimateSecondsRemaining, round } from "./pricingService.js";

export interface SessionService {
  startSession(stationId: string, autoStopAfterMinutes?: number): Promise<Session>;
  stopSession(sessionId: string, reason?: StopReason): Promise<Session>;
  getSession(sessionId: string): Promise<Session>;
}

export function createSessionService(deps: {
  sessionRepository: SessionRepository;
  stationRepository: StationRepository;
  walletRepository: WalletRepository;
  rateSchedule: RateSchedule;
  now?: () => Date;
}): SessionService {
  const { sessionRepository, stationRepository, walletRepository, rateSchedule, now = () => new Date() } = deps;

  // Live "time left on current balance" for an active session, attached to
  // API responses only — never persisted, since it depends on the wallet
  // balance which can change independently of the session (e.g. a top-up).
  // The wallet is global/shared, so "how much longer can this session run"
  // depends on every other active session drawing on it too: secondsRemaining
  // is a shared countdown computed from the combined cost-so-far and combined
  // burn rate of every currently active session, not this one in isolation.
  // costSoFar/ratePerHour on the returned estimate stay session-specific —
  // only secondsRemaining reflects the pooled wallet.
  async function attachChargeEstimate(session: Session): Promise<Session> {
    if (session.endTime !== null) {
      return { ...session, chargeEstimate: null };
    }
    const station = await stationRepository.findById(session.stationId);
    if (!station) {
      return { ...session, chargeEstimate: null };
    }
    const nowDate = now();
    const ratePerKwh = currentRatePerKwh(nowDate, rateSchedule);
    const costSoFar = calculateCost(new Date(session.startTime), nowDate, station.chargingSpeedKw, rateSchedule).totalCost;
    const ratePerHour = station.chargingSpeedKw * ratePerKwh;

    const [wallet, activeSessions] = await Promise.all([walletRepository.getWallet(), sessionRepository.findActive()]);
    let combinedCostSoFar = 0;
    let combinedRatePerHour = 0;
    for (const active of activeSessions) {
      const activeStation = active.stationId === session.stationId ? station : await stationRepository.findById(active.stationId);
      if (!activeStation) {
        continue;
      }
      combinedCostSoFar += calculateCost(new Date(active.startTime), nowDate, activeStation.chargingSpeedKw, rateSchedule).totalCost;
      combinedRatePerHour += activeStation.chargingSpeedKw * ratePerKwh;
    }

    const chargeEstimate = {
      costSoFar: round(costSoFar, 2),
      ratePerHour: round(ratePerHour, 2),
      secondsRemaining: estimateSecondsRemaining(wallet.balance - combinedCostSoFar, combinedRatePerHour),
    };
    return { ...session, chargeEstimate };
  }

  return {
    async startSession(stationId, autoStopAfterMinutes) {
      // Checked before touching station state: we don't know a session's
      // cost until it stops, so this is a coarse "can they afford to charge
      // at all" gate, not a hold on the eventual cost.
      const wallet = await walletRepository.getWallet();
      if (wallet.balance <= 0) {
        throw new InsufficientFundsError();
      }

      const occupied = await stationRepository.tryOccupy(stationId);
      if (!occupied) {
        const station = await stationRepository.findById(stationId);
        if (!station) {
          throw new NotFoundError(`Station ${stationId} not found`);
        }
        throw new ConflictError(`Station ${stationId} is already occupied`);
      }

      const startTime = now();
      const session: Session = {
        id: randomUUID(),
        stationId,
        startTime: startTime.toISOString(),
        endTime: null,
        energyUsedKwh: null,
        cost: null,
        costBreakdown: null,
        autoStopAt:
          autoStopAfterMinutes !== undefined
            ? new Date(startTime.getTime() + autoStopAfterMinutes * 60_000).toISOString()
            : null,
        stopReason: null,
      };
      const saved = await sessionRepository.save(session);
      return attachChargeEstimate(saved);
    },

    async stopSession(sessionId, reason = "manual") {
      const session = await sessionRepository.findById(sessionId);
      if (!session) {
        throw new NotFoundError(`Session ${sessionId} not found`);
      }
      // Unlike startSession's tryOccupy, this check-then-write isn't a single
      // atomic step — the spec scopes concurrency safety to station status,
      // not session stop. Documented as a known limitation in the README.
      if (session.endTime !== null) {
        throw new ConflictError(`Session ${sessionId} is already stopped`);
      }

      // Station is static seed data, so this lookup can't fail in practice —
      // guarded anyway per the fail-safe-defaults principle.
      const station = await stationRepository.findById(session.stationId);
      if (!station) {
        throw new NotFoundError(`Station ${session.stationId} not found`);
      }

      const endTime = now();
      const breakdown = calculateCost(new Date(session.startTime), endTime, station.chargingSpeedKw, rateSchedule);

      const updated: Session = {
        ...session,
        endTime: endTime.toISOString(),
        energyUsedKwh: breakdown.totalKwh,
        cost: breakdown.totalCost,
        costBreakdown: breakdown,
        stopReason: reason,
      };

      await stationRepository.release(session.stationId);
      const saved = await sessionRepository.save(updated);
      // Energy was already consumed, so this always goes through — even if
      // it pushes the balance negative — rather than leaving a completed
      // session unbilled.
      await walletRepository.deduct(breakdown.totalCost, session.id);
      return attachChargeEstimate(saved);
    },

    async getSession(sessionId) {
      const session = await sessionRepository.findById(sessionId);
      if (!session) {
        throw new NotFoundError(`Session ${sessionId} not found`);
      }
      return attachChargeEstimate(session);
    },
  };
}
