import { describe, expect, it } from "vitest";
import type { Session } from "../models/index.js";
import { InMemorySessionRepository } from "./InMemorySessionRepository.js";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    stationId: "s1",
    startTime: "2026-01-01T10:00:00.000Z",
    endTime: null,
    energyUsedKwh: null,
    cost: null,
    costBreakdown: null,
    autoStopAt: null,
    stopReason: null,
    ...overrides,
  };
}

describe("InMemorySessionRepository", () => {
  it("save then findById returns the stored session", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeSession());
    expect(await repo.findById("session-1")).toEqual(makeSession());
  });

  it("findById returns undefined for an unknown id", async () => {
    const repo = new InMemorySessionRepository();
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("save overwrites an existing session by id", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeSession());
    await repo.save(makeSession({ endTime: "2026-01-01T11:00:00.000Z", cost: 5 }));
    expect((await repo.findById("session-1"))?.cost).toBe(5);
  });

  it("does not expose the internal record by reference", async () => {
    const repo = new InMemorySessionRepository();
    const saved = await repo.save(makeSession());
    saved.cost = 999;
    expect((await repo.findById("session-1"))?.cost).toBeNull();
  });

  it("findActive returns only sessions with a null endTime", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeSession({ id: "active-1" }));
    await repo.save(makeSession({ id: "stopped-1", endTime: "2026-01-01T11:00:00.000Z" }));
    await repo.save(makeSession({ id: "active-2" }));

    const active = await repo.findActive();
    expect(active.map((s) => s.id).sort()).toEqual(["active-1", "active-2"]);
  });
});
