import type { CostBreakdown, RateSchedule } from "../models/index.js";

const HOUR_MS = 3_600_000;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function isPeak(ms: number, schedule: RateSchedule): boolean {
  const hour = new Date(ms).getUTCHours();
  return hour >= schedule.peakStartHour && hour < schedule.peakEndHour;
}

/** The next instant strictly after `ms` where the peak/off-peak band changes. */
function nextBoundaryAfter(ms: number, schedule: RateSchedule): number {
  const dayStart = startOfUtcDay(ms);
  const candidates = [
    dayStart + schedule.peakStartHour * HOUR_MS,
    dayStart + schedule.peakEndHour * HOUR_MS,
    dayStart + 24 * HOUR_MS + schedule.peakStartHour * HOUR_MS,
  ];
  return Math.min(...candidates.filter((candidate) => candidate > ms));
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Splits [startTime, endTime) into sub-intervals at every peak/off-peak
 * boundary crossed, prices each sub-interval by duration x charging speed
 * x the applicable rate, and sums the result. Pure and framework-free —
 * no I/O, no mutation of its inputs — so it's directly unit-testable.
 *
 * Peak/off-peak boundaries are evaluated in UTC (see README assumptions:
 * there's no station-location or user-locale concept in this project, so
 * one fixed reference frame is used everywhere instead of guessing a zone).
 */
export function calculateCost(
  startTime: Date,
  endTime: Date,
  chargingSpeedKw: number,
  rateSchedule: RateSchedule,
): CostBreakdown {
  if (endTime.getTime() < startTime.getTime()) {
    throw new RangeError("endTime must not be before startTime");
  }
  if (!(chargingSpeedKw > 0)) {
    throw new RangeError("chargingSpeedKw must be a positive number");
  }

  const end = endTime.getTime();
  let cursor = startTime.getTime();
  let peakKwh = 0;
  let offPeakKwh = 0;

  while (cursor < end) {
    const boundary = Math.min(nextBoundaryAfter(cursor, rateSchedule), end);
    const hours = (boundary - cursor) / HOUR_MS;
    const energy = hours * chargingSpeedKw;

    if (isPeak(cursor, rateSchedule)) {
      peakKwh += energy;
    } else {
      offPeakKwh += energy;
    }

    cursor = boundary;
  }

  const peakCost = round(peakKwh * rateSchedule.peakRatePerKwh, 2);
  const offPeakCost = round(offPeakKwh * rateSchedule.offPeakRatePerKwh, 2);

  return {
    peakKwh: round(peakKwh, 3),
    offPeakKwh: round(offPeakKwh, 3),
    peakCost,
    offPeakCost,
    totalKwh: round(peakKwh + offPeakKwh, 3),
    totalCost: round(peakCost + offPeakCost, 2),
  };
}

/** The peak or off-peak rate in effect at `now`. */
export function currentRatePerKwh(now: Date, rateSchedule: RateSchedule): number {
  return isPeak(now.getTime(), rateSchedule) ? rateSchedule.peakRatePerKwh : rateSchedule.offPeakRatePerKwh;
}

/**
 * Projects how much longer charging can continue on a remaining balance at
 * a given combined burn rate, holding the current rate constant (i.e.
 * ignoring any peak/off-peak boundary that might be crossed before the
 * balance runs out). That's a deliberate approximation for a live "time
 * left" estimate — good enough to warn a user, not meant to be as exact as
 * the final calculateCost billing.
 *
 * `balanceRemaining` and `ratePerHour` are expected to already account for
 * every session currently drawing on the same wallet, not just one — see
 * sessionService.attachChargeEstimate, which is the caller that assembles
 * those combined totals.
 */
export function estimateSecondsRemaining(balanceRemaining: number, ratePerHour: number): number {
  const hoursRemaining = ratePerHour > 0 ? Math.max(0, balanceRemaining / ratePerHour) : 0;
  return Math.round(hoursRemaining * 3600);
}
