import type { RateSchedule, Station } from "../models/index.js";

export const RATE_SCHEDULE: RateSchedule = {
  peakRatePerKwh: 0.35,
  offPeakRatePerKwh: 0.18,
  peakStartHour: 8,
  peakEndHour: 20,
};

export const SEED_STATIONS: Station[] = [
  {
    id: "station-1",
    name: "Downtown Garage A",
    location: "123 Main St",
    chargingSpeedKw: 50,
    status: "available",
  },
  {
    id: "station-2",
    name: "Downtown Garage B",
    location: "123 Main St",
    chargingSpeedKw: 150,
    status: "available",
  },
  {
    id: "station-3",
    name: "Airport Lot 3",
    location: "900 Terminal Rd",
    chargingSpeedKw: 22,
    status: "available",
  },
  {
    id: "station-4",
    name: "Mall West Entrance",
    location: "55 Commerce Ave",
    chargingSpeedKw: 11,
    status: "available",
  },
];
