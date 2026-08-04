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

export type StopReason = "manual" | "insufficient_funds" | "duration_elapsed";

export interface ChargeEstimate {
  costSoFar: number;
  ratePerHour: number;
  secondsRemaining: number;
}

export interface Session {
  id: string;
  stationId: string;
  startTime: string; // ISO 8601
  endTime: string | null; // ISO 8601, null while active
  energyUsedKwh: number | null; // null until stopped
  cost: number | null; // null until stopped
  costBreakdown: CostBreakdown | null; // null until stopped
  autoStopAt: string | null; // ISO 8601, set only if the user chose a duration limit at start
  stopReason: StopReason | null; // null while active
  // Computed live on read for an active session, based on the current wallet
  // balance and rate — not persisted by the repository.
  chargeEstimate?: ChargeEstimate | null;
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
