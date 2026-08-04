import type { Wallet, WalletTransaction } from "../models/index.js";

export interface WalletRepository {
  getWallet(): Promise<Wallet>;

  /**
   * Deducts `amount` and records a transaction tied to `sessionId`.
   * Unconditional: the energy was already consumed by the time a session
   * stops, so this always succeeds and can push the balance negative —
   * there's no "insufficient funds" check here. That check only makes
   * sense before a session starts (see sessionService.startSession).
   */
  deduct(amount: number, sessionId: string): Promise<WalletTransaction>;

  load(amount: number, note: string): Promise<WalletTransaction>;
}
