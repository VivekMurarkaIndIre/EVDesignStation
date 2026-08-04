import rateLimit from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { RateSchedule, Station } from "./models/index.js";
import { createApp } from "./app.js";
import { InMemorySessionRepository } from "./repositories/InMemorySessionRepository.js";
import { InMemoryStationRepository } from "./repositories/InMemoryStationRepository.js";
import { InMemoryWalletRepository } from "./repositories/InMemoryWalletRepository.js";

const SCHEDULE: RateSchedule = {
  peakRatePerKwh: 0.35,
  offPeakRatePerKwh: 0.18,
  peakStartHour: 8,
  peakEndHour: 20,
};

const STATIONS: Station[] = [
  { id: "s1", name: "Station 1", location: "Somewhere", chargingSpeedKw: 50, status: "available", lat: 53.35, lng: -6.26 },
  { id: "s2", name: "Station 2", location: "Elsewhere", chargingSpeedKw: 20, status: "available", lat: 53.34, lng: -6.25 },
];

function buildApp(overrides: { now?: () => Date; walletBalance?: number } = {}) {
  const stationRepository = new InMemoryStationRepository(STATIONS.map((s) => ({ ...s })));
  const sessionRepository = new InMemorySessionRepository();
  const walletRepository = new InMemoryWalletRepository(overrides.walletBalance ?? 10);
  const app = createApp({
    stationRepository,
    sessionRepository,
    walletRepository,
    rateSchedule: SCHEDULE,
    now: overrides.now,
  });
  return { app, stationRepository, sessionRepository, walletRepository };
}

describe("GET /stations", () => {
  it("lists seeded stations with live status", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/stations");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((s: Station) => s.id).sort()).toEqual(["s1", "s2"]);
  });
});

describe("GET /rate-schedule", () => {
  it("returns the configured rate schedule", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/rate-schedule");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(SCHEDULE);
  });
});

describe("POST /sessions", () => {
  it("starts a session at an available station and occupies it", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/sessions").send({ stationId: "s1" });
    expect(res.status).toBe(201);
    expect(res.body.stationId).toBe("s1");
    expect(res.body.endTime).toBeNull();

    const stations = await request(app).get("/stations");
    expect(stations.body.find((s: Station) => s.id === "s1").status).toBe("occupied");
  });

  it("rejects starting a second session at an already-occupied station (double-start)", async () => {
    const { app } = buildApp();
    const first = await request(app).post("/sessions").send({ stationId: "s1" });
    expect(first.status).toBe(201);

    const second = await request(app).post("/sessions").send({ stationId: "s1" });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/occupied/i);
  });

  it("rejects starting a session at an unknown station", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/sessions").send({ stationId: "does-not-exist" });
    expect(res.status).toBe(404);
  });

  it("rejects a malformed request body before it reaches the service", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/sessions").send({});
    expect(res.status).toBe(400);
  });

  it("rejects starting a session when the wallet balance is insufficient, without occupying the station", async () => {
    const { app } = buildApp({ walletBalance: 0 });
    const res = await request(app).post("/sessions").send({ stationId: "s1" });
    expect(res.status).toBe(402);

    const stations = await request(app).get("/stations");
    expect(stations.body.find((s: Station) => s.id === "s1").status).toBe("available");
  });
});

describe("PATCH /sessions/:id/stop", () => {
  it("rejects stopping a session that was never started (stop-before-start)", async () => {
    const { app } = buildApp();
    const res = await request(app).patch("/sessions/does-not-exist/stop");
    expect(res.status).toBe(404);
  });

  it("rejects stopping an already-stopped session", async () => {
    const { app } = buildApp();
    const start = await request(app).post("/sessions").send({ stationId: "s1" });
    const sessionId = start.body.id;

    const firstStop = await request(app).patch(`/sessions/${sessionId}/stop`);
    expect(firstStop.status).toBe(200);

    const secondStop = await request(app).patch(`/sessions/${sessionId}/stop`);
    expect(secondStop.status).toBe(409);
  });

  it("releases the station back to available on stop", async () => {
    const { app } = buildApp();
    const start = await request(app).post("/sessions").send({ stationId: "s1" });
    await request(app).patch(`/sessions/${start.body.id}/stop`);

    const stations = await request(app).get("/stations");
    expect(stations.body.find((s: Station) => s.id === "s1").status).toBe("available");
  });

  it("computes a correct peak/off-peak cost split for a session crossing one boundary", async () => {
    const fixedNow = new Date("2026-01-05T10:00:00Z");
    const { app, sessionRepository, stationRepository } = buildApp({ now: () => fixedNow });

    // Seed a session directly so its startTime can cross a rate boundary
    // relative to the fixed clock, without waiting hours in a test.
    await stationRepository.tryOccupy("s1"); // 50 kW station
    await sessionRepository.save({
      id: "boundary-session",
      stationId: "s1",
      startTime: "2026-01-05T06:00:00.000Z", // 2h off-peak, then 2h peak until 10:00
      endTime: null,
      energyUsedKwh: null,
      cost: null,
      costBreakdown: null,
      autoStopAt: null,
      stopReason: null,
    });

    const res = await request(app).patch("/sessions/boundary-session/stop");
    expect(res.status).toBe(200);
    expect(res.body.costBreakdown).toEqual({
      peakKwh: 100,
      offPeakKwh: 100,
      peakCost: 35,
      offPeakCost: 18,
      totalKwh: 200,
      totalCost: 53,
    });
    expect(res.body.energyUsedKwh).toBe(200);
    expect(res.body.cost).toBe(53);
  });

  it("deducts the session cost from the wallet and records a transaction on stop", async () => {
    const { app, walletRepository } = buildApp({ walletBalance: 10 });
    const start = await request(app).post("/sessions").send({ stationId: "s2" });
    const stop = await request(app).patch(`/sessions/${start.body.id}/stop`);

    const wallet = await walletRepository.getWallet();
    expect(wallet.balance).toBe(10 - stop.body.cost);
    const deduction = wallet.transactions.find((t) => t.sessionId === start.body.id);
    expect(deduction).toMatchObject({ type: "deduction", amount: stop.body.cost, sessionId: start.body.id });
  });

  it("still deducts and completes the stop even if the wallet balance goes negative", async () => {
    // 2h at 50 kW is 100 kWh, which exceeds the $10 balance even at the
    // cheaper off-peak rate ($18), so this holds regardless of which band
    // the fixed clock lands in.
    const fixedStart = new Date("2026-01-05T10:00:00Z");
    const fixedEnd = new Date("2026-01-05T12:00:00Z");
    let callCount = 0;
    const { app, walletRepository } = buildApp({
      walletBalance: 10,
      now: () => (callCount++ === 0 ? fixedStart : fixedEnd),
    });

    const start = await request(app).post("/sessions").send({ stationId: "s1" });
    const stop = await request(app).patch(`/sessions/${start.body.id}/stop`);

    expect(stop.status).toBe(200);
    expect(stop.body.cost).toBeGreaterThan(10);
    expect((await walletRepository.getWallet()).balance).toBeLessThan(0);
  });
});

describe("charge estimate and auto-stop configuration", () => {
  it("attaches a live chargeEstimate to an active session and null to a stopped one", async () => {
    const fixedNow = new Date("2026-01-05T10:00:00Z");
    const { app } = buildApp({ now: () => fixedNow, walletBalance: 10 });

    const start = await request(app).post("/sessions").send({ stationId: "s1" }); // 50 kW, peak rate 0.35
    expect(start.body.chargeEstimate).toEqual({ costSoFar: 0, ratePerHour: 17.5, secondsRemaining: 2057 });

    const stop = await request(app).patch(`/sessions/${start.body.id}/stop`);
    expect(stop.body.chargeEstimate).toBeNull();
  });

  it("recomputes chargeEstimate.secondsRemaining for every active session once another one starts drawing on the same wallet", async () => {
    const fixedNow = new Date("2026-01-05T10:00:00Z");
    const { app } = buildApp({ now: () => fixedNow, walletBalance: 10 });

    const first = await request(app).post("/sessions").send({ stationId: "s1" }); // 50 kW -> $17.50/hr
    expect(first.body.chargeEstimate.secondsRemaining).toBe(Math.round((10 / 17.5) * 3600));

    const second = await request(app).post("/sessions").send({ stationId: "s2" }); // 20 kW -> $7/hr
    const combinedRatePerHour = 17.5 + 7;
    const combinedSecondsRemaining = Math.round((10 / combinedRatePerHour) * 3600);
    expect(second.body.chargeEstimate.secondsRemaining).toBe(combinedSecondsRemaining);
    // Adding a second draw on the shared wallet shortens it below what it
    // projected when it was the only session running.
    expect(combinedSecondsRemaining).toBeLessThan(Math.round((10 / 17.5) * 3600));

    // Re-fetching the first session reflects the second session's draw too,
    // even though nothing about the first session itself changed.
    const firstAfter = await request(app).get(`/sessions/${first.body.id}`);
    expect(firstAfter.body.chargeEstimate.secondsRemaining).toBe(combinedSecondsRemaining);
  });

  it("sets autoStopAt from autoStopAfterMinutes at start time", async () => {
    const fixedNow = new Date("2026-01-05T10:00:00Z");
    const { app } = buildApp({ now: () => fixedNow });

    const res = await request(app).post("/sessions").send({ stationId: "s1", autoStopAfterMinutes: 30 });
    expect(res.body.autoStopAt).toBe("2026-01-05T10:30:00.000Z");
  });

  it("leaves autoStopAt null when no duration is chosen", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/sessions").send({ stationId: "s1" });
    expect(res.body.autoStopAt).toBeNull();
  });

  it("rejects an out-of-range autoStopAfterMinutes", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/sessions").send({ stationId: "s1", autoStopAfterMinutes: -5 });
    expect(res.status).toBe(400);
  });

  it("records stopReason 'manual' for a normal stop", async () => {
    const { app } = buildApp();
    const start = await request(app).post("/sessions").send({ stationId: "s1" });
    const stop = await request(app).patch(`/sessions/${start.body.id}/stop`);
    expect(stop.body.stopReason).toBe("manual");
  });
});

describe("GET /wallet", () => {
  it("returns the current balance and transaction history", async () => {
    const { app } = buildApp({ walletBalance: 10 });
    const res = await request(app).get("/wallet");
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(10);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].type).toBe("load");
  });

  it("reflects a deduction after a session is stopped", async () => {
    const { app } = buildApp({ walletBalance: 10 });
    const start = await request(app).post("/sessions").send({ stationId: "s1" });
    await request(app).patch(`/sessions/${start.body.id}/stop`);

    const res = await request(app).get("/wallet");
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.transactions.some((t: { type: string }) => t.type === "deduction")).toBe(true);
  });
});

describe("POST /reset", () => {
  it("restores stations, clears sessions, and resets the wallet to its initial balance", async () => {
    const { app } = buildApp({ walletBalance: 10 });

    const start = await request(app).post("/sessions").send({ stationId: "s1" });
    await request(app).patch(`/sessions/${start.body.id}/stop`);
    await request(app).post("/sessions").send({ stationId: "s2" }); // left active

    const res = await request(app).post("/reset");
    expect(res.status).toBe(200);

    const stations = await request(app).get("/stations");
    expect(stations.body.every((s: Station) => s.status === "available")).toBe(true);

    const stopped = await request(app).get(`/sessions/${start.body.id}`);
    expect(stopped.status).toBe(404);

    const wallet = await request(app).get("/wallet");
    expect(wallet.body.balance).toBe(10);
    expect(wallet.body.transactions).toHaveLength(1);
    expect(wallet.body.transactions[0].type).toBe("load");
  });
});

describe("GET /sessions/:id", () => {
  it("returns session detail including the peak/off-peak split after stopping", async () => {
    const { app } = buildApp();
    const start = await request(app).post("/sessions").send({ stationId: "s2" });
    await request(app).patch(`/sessions/${start.body.id}/stop`);

    const res = await request(app).get(`/sessions/${start.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.costBreakdown).toBeDefined();
    expect(res.body.cost).toBeGreaterThanOrEqual(0);
  });

  it("returns 404 for an unknown session id", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/sessions/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("error handling", () => {
  it("never leaks a stack trace on an unexpected error", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/sessions/does-not-exist");
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it("returns 404 for an unmatched route", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("rate limiting", () => {
  it("returns 429 once the session-action limit is exceeded", async () => {
    const stationRepository = new InMemoryStationRepository(STATIONS.map((s) => ({ ...s })));
    const sessionRepository = new InMemorySessionRepository();
    const app = createApp({
      stationRepository,
      sessionRepository,
      rateSchedule: SCHEDULE,
      sessionActionRateLimiter: rateLimit({ windowMs: 60_000, limit: 2 }),
    });

    await request(app).post("/sessions").send({ stationId: "does-not-exist" });
    await request(app).post("/sessions").send({ stationId: "does-not-exist" });
    const res = await request(app).post("/sessions").send({ stationId: "does-not-exist" });

    expect(res.status).toBe(429);
  });
});

describe("concurrency", () => {
  it("only one of many concurrent session-start requests at the same station succeeds", async () => {
    const stationRepository = new InMemoryStationRepository(STATIONS.map((s) => ({ ...s })));
    const sessionRepository = new InMemorySessionRepository();
    const app = createApp({
      stationRepository,
      sessionRepository,
      rateSchedule: SCHEDULE,
      sessionActionRateLimiter: rateLimit({ windowMs: 60_000, limit: 1000 }),
    });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => request(app).post("/sessions").send({ stationId: "s1" })),
    );

    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    expect(responses.filter((res) => res.status === 409)).toHaveLength(9);
  });
});
