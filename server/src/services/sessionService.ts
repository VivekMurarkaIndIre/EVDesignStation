import { randomUUID } from "node:crypto";
import type { RateSchedule, Session } from "../models/index.js";
import { ConflictError, InsufficientFundsError, NotFoundError } from "../middleware/errors.js";
import type { SessionRepository } from "../repositories/SessionRepository.js";
import type { StationRepository } from "../repositories/StationRepository.js";
import type { WalletRepository } from "../repositories/WalletRepository.js";
import { calculateCost } from "./pricingService.js";

export interface SessionService {
  startSession(stationId: string): Promise<Session>;
  stopSession(sessionId: string): Promise<Session>;
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

  return {
    async startSession(stationId) {
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

      const session: Session = {
        id: randomUUID(),
        stationId,
        startTime: now().toISOString(),
        endTime: null,
        energyUsedKwh: null,
        cost: null,
        costBreakdown: null,
      };
      return sessionRepository.save(session);
    },

    async stopSession(sessionId) {
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
      };

      await stationRepository.release(session.stationId);
      const saved = await sessionRepository.save(updated);
      // Energy was already consumed, so this always goes through — even if
      // it pushes the balance negative — rather than leaving a completed
      // session unbilled.
      await walletRepository.deduct(breakdown.totalCost, session.id);
      return saved;
    },

    async getSession(sessionId) {
      const session = await sessionRepository.findById(sessionId);
      if (!session) {
        throw new NotFoundError(`Session ${sessionId} not found`);
      }
      return session;
    },
  };
}
