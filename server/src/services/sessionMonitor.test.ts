import { describe, expect, it } from "vitest";
import type { RateSchedule, Station } from "../models/index.js";
import { InMemorySessionRepository } from "../repositories/InMemorySessionRepository.js";
import { InMemoryStationRepository } from "../repositories/InMemoryStationRepository.js";
import { InMemoryWalletRepository } from "../repositories/InMemoryWalletRepository.js";
import type { SessionRepository } from "../repositories/SessionRepository.js";
import { createSessionMonitor } from "./sessionMonitor.js";
import { createSessionService } from "./sessionService.js";

const SCHEDULE: RateSchedule = {
  peakRatePerKwh: 0.35,
  offPeakRatePerKwh: 0.18,
  peakStartHour: 8,
  peakEndHour: 20,
};

const STATIONS: Station[] = [
  { id: "s1", name: "Station 1", location: "Somewhere", chargingSpeedKw: 50, status: "available", lat: 0, lng: 0 },
  { id: "s2", name: "Station 2", location: "Elsewhere", chargingSpeedKw: 11, status: "available", lat: 0, lng: 0 },
];

function buildMonitor(overrides: { now?: () => Date; walletBalance?: number } = {}) {
  const stationRepository = new InMemoryStationRepository(STATIONS.map((s) => ({ ...s })));
  const sessionRepository = new InMemorySessionRepository();
  const walletRepository = new InMemoryWalletRepository(overrides.walletBalance ?? 10);
  const now = overrides.now ?? (() => new Date("2026-01-05T10:00:00Z"));
  const sessionService = createSessionService({
    sessionRepository,
    stationRepository,
    walletRepository,
    rateSchedule: SCHEDULE,
    now,
  });
  const monitor = createSessionMonitor({
    sessionRepository,
    stationRepository,
    walletRepository,
    sessionService,
    rateSchedule: SCHEDULE,
    now,
  });
  return { monitor, sessionService, sessionRepository, walletRepository, now };
}

describe("sessionMonitor", () => {
  it("stops an active session once its cost so far consumes the wallet balance", async () => {
    let current = new Date("2026-01-05T10:00:00Z");
    const { monitor, sessionService, sessionRepository } = buildMonitor({ now: () => current, walletBalance: 10 });

    const session = await sessionService.startSession("s1");
    // 50 kW * $0.35/kWh peak = $17.50/hr, so $10 is spent well within an hour.
    current = new Date("2026-01-05T10:35:00Z");

    await monitor.tick();

    const stored = await sessionRepository.findById(session.id);
    expect(stored?.endTime).not.toBeNull();
    expect(stored?.stopReason).toBe("insufficient_funds");
  });

  it("leaves a session running when the balance comfortably covers the cost so far", async () => {
    let current = new Date("2026-01-05T10:00:00Z");
    const { monitor, sessionService, sessionRepository } = buildMonitor({ now: () => current, walletBalance: 100 });

    const session = await sessionService.startSession("s1");
    current = new Date("2026-01-05T10:05:00Z");

    await monitor.tick();

    const stored = await sessionRepository.findById(session.id);
    expect(stored?.endTime).toBeNull();
  });

  it("stops an active session once its chosen auto-stop duration elapses", async () => {
    let current = new Date("2026-01-05T10:00:00Z");
    const { monitor, sessionService, sessionRepository } = buildMonitor({ now: () => current, walletBalance: 1000 });

    const session = await sessionService.startSession("s1", 15);
    current = new Date("2026-01-05T10:16:00Z"); // 16 min later, past the 15 min limit

    await monitor.tick();

    const stored = await sessionRepository.findById(session.id);
    expect(stored?.endTime).not.toBeNull();
    expect(stored?.stopReason).toBe("duration_elapsed");
  });

  it("does not stop a session before its auto-stop duration elapses", async () => {
    let current = new Date("2026-01-05T10:00:00Z");
    const { monitor, sessionService, sessionRepository } = buildMonitor({ now: () => current, walletBalance: 1000 });

    const session = await sessionService.startSession("s1", 15);
    current = new Date("2026-01-05T10:10:00Z");

    await monitor.tick();

    const stored = await sessionRepository.findById(session.id);
    expect(stored?.endTime).toBeNull();
  });

  it("stops every active session once their combined cost drains the shared wallet, even though no single session's own cost exceeds it alone", async () => {
    let current = new Date("2026-01-05T10:00:00Z");
    const { monitor, sessionService, sessionRepository } = buildMonitor({ now: () => current, walletBalance: 10 });

    // s1 (50 kW) costs $8.46 and s2 (11 kW) costs $1.86 by themselves after
    // 29 min at the peak rate — neither alone exceeds $10, but together
    // they've drawn $10.32 from the one shared wallet.
    const sessionA = await sessionService.startSession("s1");
    const sessionB = await sessionService.startSession("s2");
    current = new Date("2026-01-05T10:29:00Z");

    await monitor.tick();

    const storedA = await sessionRepository.findById(sessionA.id);
    const storedB = await sessionRepository.findById(sessionB.id);
    expect(storedA?.endTime).not.toBeNull();
    expect(storedA?.stopReason).toBe("insufficient_funds");
    expect(storedB?.endTime).not.toBeNull();
    expect(storedB?.stopReason).toBe("insufficient_funds");
  });

  it("leaves both sessions running while their combined cost is still under the shared balance", async () => {
    let current = new Date("2026-01-05T10:00:00Z");
    const { monitor, sessionService, sessionRepository } = buildMonitor({ now: () => current, walletBalance: 10 });

    const sessionA = await sessionService.startSession("s1");
    const sessionB = await sessionService.startSession("s2");
    current = new Date("2026-01-05T10:20:00Z"); // combined cost so far ~$7.12

    await monitor.tick();

    expect((await sessionRepository.findById(sessionA.id))?.endTime).toBeNull();
    expect((await sessionRepository.findById(sessionB.id))?.endTime).toBeNull();
  });

  it("silently tolerates a session that was already stopped between listing and processing", async () => {
    let current = new Date("2026-01-05T10:00:00Z");
    const stationRepository = new InMemoryStationRepository(STATIONS.map((s) => ({ ...s })));
    const realSessionRepository = new InMemorySessionRepository();
    const walletRepository = new InMemoryWalletRepository(1000);
    const now = () => current;
    const sessionService = createSessionService({
      sessionRepository: realSessionRepository,
      stationRepository,
      walletRepository,
      rateSchedule: SCHEDULE,
      now,
    });

    const session = await sessionService.startSession("s1", 15);
    current = new Date("2026-01-05T10:16:00Z");

    // Simulates another caller (e.g. the manual stop endpoint) winning a
    // race: it stops the session for real right after findActive() lists it
    // as still active, but before this tick's own stopSession call runs.
    const racyRepository: SessionRepository = {
      save: (s) => realSessionRepository.save(s),
      findById: (id) => realSessionRepository.findById(id),
      findActive: async () => {
        const active = await realSessionRepository.findActive();
        await sessionService.stopSession(session.id);
        return active;
      },
    };

    const monitor = createSessionMonitor({
      sessionRepository: racyRepository,
      stationRepository,
      walletRepository,
      sessionService,
      rateSchedule: SCHEDULE,
      now,
    });

    await expect(monitor.tick()).resolves.toBeUndefined();
    const stored = await realSessionRepository.findById(session.id);
    expect(stored?.stopReason).toBe("manual");
  });
});
