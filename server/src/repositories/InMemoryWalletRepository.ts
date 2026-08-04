import { randomUUID } from "node:crypto";
import type { Wallet, WalletTransaction } from "../models/index.js";
import type { WalletRepository } from "./WalletRepository.js";

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export class InMemoryWalletRepository implements WalletRepository {
  private balance = 0;
  private readonly transactions: WalletTransaction[] = [];

  constructor(initialBalance = 0, note = "Initial wallet funding") {
    if (initialBalance !== 0) {
      this.recordSync("load", initialBalance, null, note);
    }
  }

  async getWallet(): Promise<Wallet> {
    return { balance: this.balance, transactions: this.transactions.map((transaction) => ({ ...transaction })) };
  }

  async deduct(amount: number, sessionId: string): Promise<WalletTransaction> {
    return this.recordSync("deduction", amount, sessionId, `Charging session ${sessionId}`);
  }

  async load(amount: number, note: string): Promise<WalletTransaction> {
    return this.recordSync("load", amount, null, note);
  }

  private recordSync(
    type: WalletTransaction["type"],
    amount: number,
    sessionId: string | null,
    note: string,
  ): WalletTransaction {
    this.balance = roundCents(type === "load" ? this.balance + amount : this.balance - amount);
    const transaction: WalletTransaction = {
      id: randomUUID(),
      type,
      amount: roundCents(amount),
      sessionId,
      balanceAfter: this.balance,
      createdAt: new Date().toISOString(),
      note,
    };
    this.transactions.push(transaction);
    return { ...transaction };
  }
}
