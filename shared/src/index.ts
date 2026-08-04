export type StationStatus = "available" | "occupied";

export interface Station {
  id: string;
  name: string;
  location: string;
  chargingSpeedKw: number;
  status: StationStatus;
  lat: number;
  lng: number;
}

export interface CostBreakdown {
  peakKwh: number;
  offPeakKwh: number;
  peakCost: number;
  offPeakCost: number;
  totalKwh: number;
  totalCost: number;
}

export interface Session {
  id: string;
  stationId: string;
  startTime: string; // ISO 8601
  endTime: string | null; // ISO 8601, null while active
  energyUsedKwh: number | null; // null until stopped
  cost: number | null; // null until stopped
  costBreakdown: CostBreakdown | null; // null until stopped
}

export interface RateSchedule {
  peakRatePerKwh: number;
  offPeakRatePerKwh: number;
  peakStartHour: number; // e.g. 8 for 08:00
  peakEndHour: number; // e.g. 20 for 20:00
}

export type WalletTransactionType = "load" | "deduction";

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  amount: number; // always positive; type implies the sign
  sessionId: string | null; // set for deductions tied to a session
  balanceAfter: number;
  createdAt: string; // ISO 8601
  note: string;
}

export interface Wallet {
  balance: number;
  transactions: WalletTransaction[];
}
