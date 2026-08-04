import type { Wallet } from "../models/index.js";
import type { WalletRepository } from "../repositories/WalletRepository.js";

export interface WalletService {
  getWallet(): Promise<Wallet>;
}

export function createWalletService(deps: { walletRepository: WalletRepository }): WalletService {
  const { walletRepository } = deps;

  return {
    async getWallet() {
      return walletRepository.getWallet();
    },
  };
}
