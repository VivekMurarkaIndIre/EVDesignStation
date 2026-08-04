import type { Station } from "../models/index.js";

export interface StationRepository {
  findAll(): Promise<Station[]>;
  findById(id: string): Promise<Station | undefined>;

  /**
   * Atomically transitions a station from available -> occupied.
   * Returns the updated station, or undefined if the station doesn't
   * exist or wasn't available (already occupied). Callers must not
   * implement this as a separate find + update — the atomicity here is
   * what prevents two concurrent session-start requests from both
   * succeeding on the same station.
   */
  tryOccupy(id: string): Promise<Station | undefined>;

  /** Transitions a station back to available. Returns undefined if it doesn't exist. */
  release(id: string): Promise<Station | undefined>;
}
