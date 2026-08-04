import rateLimit from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { RateSchedule, Station } from "./models/index.js";
import { createApp } from "./app.js";
import { InMemorySessionRepository } from "./repositories/InMemorySessionRepository.js";
import { InMemoryStationRepository } from "./repositories/InMemoryStationRepository.js";

const SCHEDULE: RateSchedule = {
  peakRatePerKwh: 0.35,
  offPeakRatePerKwh: 0.18,
  peakStartHour: 8,
  peakEndHour: 20,
};

const STATIONS: Station[] = [
  { id: "s1", name: "Station 1", location: "Somewhere", chargingSpeedKw: 50, status: "available" },
  { id: "s2", name: "Station 2", location: "Elsewhere", chargingSpeedKw: 20, status: "available" },
];

function buildApp(overrides: { now?: () => Date } = {}) {
  const stationRepository = new InMemoryStationRepository(STATIONS.map((s) => ({ ...s })));
  const sessionRepository = new InMemorySessionRepository();
  const app = createApp({
    stationRepository,
    sessionRepository,
    rateSchedule: SCHEDULE,
    now: overrides.now,
  });
  return { app, stationRepository, sessionRepository };
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
