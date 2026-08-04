import type { Station } from "../models/index.js";
import type { StationRepository } from "../repositories/StationRepository.js";

export interface StationService {
  listStations(): Promise<Station[]>;
}

export function createStationService(deps: { stationRepository: StationRepository }): StationService {
  const { stationRepository } = deps;

  return {
    async listStations() {
      return stationRepository.findAll();
    },
  };
}
