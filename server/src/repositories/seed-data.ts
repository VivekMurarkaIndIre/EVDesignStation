import type { RateSchedule, Station } from "../models/index.js";

export const RATE_SCHEDULE: RateSchedule = {
  peakRatePerKwh: 0.35,
  offPeakRatePerKwh: 0.18,
  peakStartHour: 8,
  peakEndHour: 20,
};

export const INITIAL_WALLET_BALANCE = 10;
export const INITIAL_WALLET_BALANCE_NOTE = "Initial wallet funding";

// All within Dublin, Ireland, so the map view has one consistent, real
// city to center/bound itself on rather than scattered placeholder pins.
export const SEED_STATIONS: Station[] = [
  {
    id: "station-1",
    name: "O'Connell Street Hub",
    location: "O'Connell St, Dublin 1",
    chargingSpeedKw: 50,
    status: "available",
    lat: 53.3498,
    lng: -6.2603,
  },
  {
    id: "station-2",
    name: "Grand Canal Dock",
    location: "Grand Canal Dock, Dublin 2",
    chargingSpeedKw: 150,
    status: "available",
    lat: 53.3441,
    lng: -6.2381,
  },
  {
    id: "station-3",
    name: "Dublin Airport T2",
    location: "Dublin Airport, Co. Dublin",
    chargingSpeedKw: 150,
    status: "available",
    lat: 53.4264,
    lng: -6.2499,
  },
  {
    id: "station-4",
    name: "Dundrum Town Centre",
    location: "Dundrum, Dublin 14",
    chargingSpeedKw: 22,
    status: "available",
    lat: 53.2896,
    lng: -6.2453,
  },
  {
    id: "station-5",
    name: "The Square, Tallaght",
    location: "Tallaght, Dublin 24",
    chargingSpeedKw: 50,
    status: "available",
    lat: 53.2859,
    lng: -6.3742,
  },
  {
    id: "station-6",
    name: "Blanchardstown Centre",
    location: "Blanchardstown, Dublin 15",
    chargingSpeedKw: 22,
    status: "available",
    lat: 53.3868,
    lng: -6.3808,
  },
  {
    id: "station-7",
    name: "Dun Laoghaire Harbour",
    location: "Dun Laoghaire, Co. Dublin",
    chargingSpeedKw: 11,
    status: "available",
    lat: 53.2946,
    lng: -6.1347,
  },
  {
    id: "station-8",
    name: "Phoenix Park Visitor Centre",
    location: "Phoenix Park, Dublin 8",
    chargingSpeedKw: 22,
    status: "available",
    lat: 53.3562,
    lng: -6.3298,
  },
  {
    id: "station-9",
    name: "Ballsbridge RDS",
    location: "Ballsbridge, Dublin 4",
    chargingSpeedKw: 50,
    status: "available",
    lat: 53.3308,
    lng: -6.2298,
  },
  {
    id: "station-10",
    name: "Smithfield Square",
    location: "Smithfield, Dublin 7",
    chargingSpeedKw: 11,
    status: "available",
    lat: 53.3489,
    lng: -6.2777,
  },
  {
    id: "station-11",
    name: "Rathmines Village",
    location: "Rathmines, Dublin 6",
    chargingSpeedKw: 22,
    status: "available",
    lat: 53.3227,
    lng: -6.2653,
  },
  {
    id: "station-12",
    name: "IFSC Plaza",
    location: "IFSC, Dublin 1",
    chargingSpeedKw: 150,
    status: "available",
    lat: 53.3494,
    lng: -6.2437,
  },
];
