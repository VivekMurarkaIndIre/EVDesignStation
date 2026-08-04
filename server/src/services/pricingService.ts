import type { CostBreakdown, RateSchedule } from "../models/index.js";

const HOUR_MS = 3_600_000;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isPeak(ms: number, schedule: RateSchedule): boolean {
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

function round(value: number, decimals: number): number {
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
