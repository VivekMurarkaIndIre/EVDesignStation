import type { Station } from "../models/index.js";
import type { StationRepository } from "./StationRepository.js";
import { SEED_STATIONS } from "./seed-data.js";

export class InMemoryStationRepository implements StationRepository {
  private readonly seed: Station[];
  private readonly stations: Map<string, Station>;

  constructor(seed: Station[] = SEED_STATIONS) {
    this.seed = seed;
    this.stations = new Map(seed.map((station) => [station.id, { ...station }]));
  }

  async findAll(): Promise<Station[]> {
    return [...this.stations.values()].map((station) => ({ ...station }));
  }

  async findById(id: string): Promise<Station | undefined> {
    const station = this.stations.get(id);
    return station ? { ...station } : undefined;
  }

  async tryOccupy(id: string): Promise<Station | undefined> {
    const station = this.stations.get(id);
    if (!station || station.status !== "available") {
      return undefined;
    }
    const updated: Station = { ...station, status: "occupied" };
    this.stations.set(id, updated);
    return { ...updated };
  }

  async release(id: string): Promise<Station | undefined> {
    const station = this.stations.get(id);
    if (!station) {
      return undefined;
    }
    const updated: Station = { ...station, status: "available" };
    this.stations.set(id, updated);
    return { ...updated };
  }

  async reset(): Promise<void> {
    this.stations.clear();
    for (const station of this.seed) {
      this.stations.set(station.id, { ...station });
    }
  }
}
