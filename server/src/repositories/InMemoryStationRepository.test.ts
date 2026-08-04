import { describe, expect, it } from "vitest";
import type { Station } from "../models/index.js";
import { InMemoryStationRepository } from "./InMemoryStationRepository.js";

const stations: Station[] = [
  { id: "s1", name: "Station 1", location: "Somewhere", chargingSpeedKw: 50, status: "available" },
];

describe("InMemoryStationRepository", () => {
  it("findAll returns seeded stations without exposing internal references", async () => {
    const repo = new InMemoryStationRepository(stations);
    const result = await repo.findAll();
    result[0].name = "mutated";
    expect((await repo.findAll())[0].name).toBe("Station 1");
  });

  it("findById returns undefined for an unknown id", async () => {
    const repo = new InMemoryStationRepository(stations);
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("tryOccupy succeeds on an available station and flips its status", async () => {
    const repo = new InMemoryStationRepository(stations);
    const occupied = await repo.tryOccupy("s1");
    expect(occupied?.status).toBe("occupied");
    expect((await repo.findById("s1"))?.status).toBe("occupied");
  });

  it("tryOccupy fails when the station is already occupied", async () => {
    const repo = new InMemoryStationRepository(stations);
    await repo.tryOccupy("s1");
    expect(await repo.tryOccupy("s1")).toBeUndefined();
  });

  it("tryOccupy fails for an unknown station", async () => {
    const repo = new InMemoryStationRepository(stations);
    expect(await repo.tryOccupy("missing")).toBeUndefined();
  });

  it("only one of many concurrent tryOccupy calls on the same station succeeds", async () => {
    const repo = new InMemoryStationRepository(stations);
    const results = await Promise.all(Array.from({ length: 20 }, () => repo.tryOccupy("s1")));
    const successes = results.filter((result) => result !== undefined);
    expect(successes).toHaveLength(1);
  });

  it("release returns a station to available", async () => {
    const repo = new InMemoryStationRepository(stations);
    await repo.tryOccupy("s1");
    const released = await repo.release("s1");
    expect(released?.status).toBe("available");
  });

  it("release fails for an unknown station", async () => {
    const repo = new InMemoryStationRepository(stations);
    expect(await repo.release("missing")).toBeUndefined();
  });
});
