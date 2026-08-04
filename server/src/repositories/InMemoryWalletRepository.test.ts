import { describe, expect, it } from "vitest";
import { InMemoryWalletRepository } from "./InMemoryWalletRepository.js";

describe("InMemoryWalletRepository", () => {
  it("starts with the given initial balance recorded as a load transaction", async () => {
    const repo = new InMemoryWalletRepository(10, "Initial wallet funding");
    const wallet = await repo.getWallet();
    expect(wallet.balance).toBe(10);
    expect(wallet.transactions).toHaveLength(1);
    expect(wallet.transactions[0]).toMatchObject({
      type: "load",
      amount: 10,
      sessionId: null,
      balanceAfter: 10,
      note: "Initial wallet funding",
    });
  });

  it("defaults to a zero balance with no transactions when constructed with no args", async () => {
    const repo = new InMemoryWalletRepository();
    const wallet = await repo.getWallet();
    expect(wallet.balance).toBe(0);
    expect(wallet.transactions).toHaveLength(0);
  });

  it("deduct records a transaction tied to the session and lowers the balance", async () => {
    const repo = new InMemoryWalletRepository(10);
    const transaction = await repo.deduct(3.5, "session-1");
    expect(transaction).toMatchObject({ type: "deduction", amount: 3.5, sessionId: "session-1", balanceAfter: 6.5 });

    const wallet = await repo.getWallet();
    expect(wallet.balance).toBe(6.5);
    expect(wallet.transactions).toHaveLength(2);
  });

  it("deduct can push the balance negative rather than rejecting", async () => {
    const repo = new InMemoryWalletRepository(5);
    const transaction = await repo.deduct(20, "session-1");
    expect(transaction.balanceAfter).toBe(-15);
    expect((await repo.getWallet()).balance).toBe(-15);
  });

  it("load increases the balance and records a load transaction", async () => {
    const repo = new InMemoryWalletRepository(0);
    await repo.load(25, "Top up");
    const wallet = await repo.getWallet();
    expect(wallet.balance).toBe(25);
    expect(wallet.transactions[0]).toMatchObject({ type: "load", amount: 25, sessionId: null, note: "Top up" });
  });

  it("rounds to the nearest cent to avoid floating-point drift across many transactions", async () => {
    const repo = new InMemoryWalletRepository(0);
    for (let i = 0; i < 3; i += 1) {
      await repo.load(0.1, "top up");
    }
    expect((await repo.getWallet()).balance).toBe(0.3);
  });

  it("does not expose transactions by reference", async () => {
    const repo = new InMemoryWalletRepository(10);
    const wallet = await repo.getWallet();
    wallet.transactions[0].amount = 999;
    expect((await repo.getWallet()).transactions[0].amount).toBe(10);
  });
});
