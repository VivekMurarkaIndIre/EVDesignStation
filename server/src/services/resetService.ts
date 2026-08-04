import type { SessionRepository } from "../repositories/SessionRepository.js";
import type { StationRepository } from "../repositories/StationRepository.js";
import type { WalletRepository } from "../repositories/WalletRepository.js";

export interface ResetService {
  reset(): Promise<void>;
}

/** Demo/testing convenience: wipes all mutable state back to its seeded starting point. See POST /reset. */
export function createResetService(deps: {
  stationRepository: StationRepository;
  sessionRepository: SessionRepository;
  walletRepository: WalletRepository;
  initialWalletBalance: number;
  initialWalletBalanceNote: string;
}): ResetService {
  const { stationRepository, sessionRepository, walletRepository, initialWalletBalance, initialWalletBalanceNote } =
    deps;

  return {
    async reset() {
      await Promise.all([
        stationRepository.reset(),
        sessionRepository.reset(),
        walletRepository.reset(initialWalletBalance, initialWalletBalanceNote),
      ]);
    },
  };
}
