import { describe, expect, it } from "vitest";
import type { RateSchedule } from "../models/index.js";
import { calculateCost } from "./pricingService.js";

const SCHEDULE: RateSchedule = {
  peakRatePerKwh: 0.35,
  offPeakRatePerKwh: 0.18,
  peakStartHour: 8,
  peakEndHour: 20,
};

function at(iso: string): Date {
  return new Date(iso);
}

describe("calculateCost", () => {
  it("prices a session entirely within peak hours", () => {
    const result = calculateCost(at("2026-01-05T10:00:00Z"), at("2026-01-05T14:00:00Z"), 50, SCHEDULE);
    expect(result).toEqual({
      peakKwh: 200,
      offPeakKwh: 0,
      peakCost: 70,
      offPeakCost: 0,
      totalKwh: 200,
      totalCost: 70,
    });
  });

  it("prices a session entirely within off-peak hours", () => {
    const result = calculateCost(at("2026-01-05T22:00:00Z"), at("2026-01-05T23:30:00Z"), 50, SCHEDULE);
    expect(result).toEqual({
      peakKwh: 0,
      offPeakKwh: 75,
      peakCost: 0,
      offPeakCost: 13.5,
      totalKwh: 75,
      totalCost: 13.5,
    });
  });

  it("splits a session crossing exactly one boundary (off-peak into peak)", () => {
    const result = calculateCost(at("2026-01-05T06:00:00Z"), at("2026-01-05T10:00:00Z"), 50, SCHEDULE);
    expect(result).toEqual({
      peakKwh: 100,
      offPeakKwh: 100,
      peakCost: 35,
      offPeakCost: 18,
      totalKwh: 200,
      totalCost: 53,
    });
  });

  it("splits a session crossing exactly one boundary (peak into off-peak)", () => {
    const result = calculateCost(at("2026-01-05T18:00:00Z"), at("2026-01-05T22:00:00Z"), 50, SCHEDULE);
    expect(result).toEqual({
      peakKwh: 100,
      offPeakKwh: 100,
      peakCost: 35,
      offPeakCost: 18,
      totalKwh: 200,
      totalCost: 53,
    });
  });

  it("splits a multi-day session crossing several boundaries (>24h)", () => {
    // day0 18:00 -> day1 22:00 (28h), crossing 20:00/day0, 08:00/day1, 20:00/day1
    const result = calculateCost(at("2026-01-05T18:00:00Z"), at("2026-01-06T22:00:00Z"), 10, SCHEDULE);
    expect(result).toEqual({
      peakKwh: 140,
      offPeakKwh: 140,
      peakCost: 49,
      offPeakCost: 25.2,
      totalKwh: 280,
      totalCost: 74.2,
    });
  });

  it("treats a session starting exactly on the peak-start boundary as peak", () => {
    const result = calculateCost(at("2026-01-05T08:00:00Z"), at("2026-01-05T09:00:00Z"), 20, SCHEDULE);
    expect(result.peakKwh).toBe(20);
    expect(result.offPeakKwh).toBe(0);
  });

  it("treats a session ending exactly on the peak-end boundary as fully peak (end instant contributes no duration)", () => {
    const result = calculateCost(at("2026-01-05T15:00:00Z"), at("2026-01-05T20:00:00Z"), 20, SCHEDULE);
    expect(result.peakKwh).toBe(100);
    expect(result.offPeakKwh).toBe(0);
  });

  it("treats a session starting exactly on the peak-end boundary as off-peak", () => {
    const result = calculateCost(at("2026-01-05T20:00:00Z"), at("2026-01-05T21:00:00Z"), 20, SCHEDULE);
    expect(result.peakKwh).toBe(0);
    expect(result.offPeakKwh).toBe(20);
  });

  it("returns an all-zero breakdown for a zero-duration session", () => {
    const result = calculateCost(at("2026-01-05T12:00:00Z"), at("2026-01-05T12:00:00Z"), 50, SCHEDULE);
    expect(result).toEqual({
      peakKwh: 0,
      offPeakKwh: 0,
      peakCost: 0,
      offPeakCost: 0,
      totalKwh: 0,
      totalCost: 0,
    });
  });

  it("rounds energy to 3 decimals and cost to 2 decimals", () => {
    const result = calculateCost(at("2026-01-05T10:00:00Z"), at("2026-01-05T10:45:00Z"), 7, SCHEDULE);
    expect(result.peakKwh).toBe(5.25);
    expect(result.peakCost).toBe(1.84); // 5.25 * 0.35 = 1.8375 -> 1.84
  });

  it("throws when endTime is before startTime", () => {
    expect(() => calculateCost(at("2026-01-05T10:00:00Z"), at("2026-01-05T09:00:00Z"), 50, SCHEDULE)).toThrow(
      RangeError,
    );
  });

  it("throws for a non-positive charging speed", () => {
    expect(() => calculateCost(at("2026-01-05T10:00:00Z"), at("2026-01-05T11:00:00Z"), 0, SCHEDULE)).toThrow(
      RangeError,
    );
    expect(() => calculateCost(at("2026-01-05T10:00:00Z"), at("2026-01-05T11:00:00Z"), -5, SCHEDULE)).toThrow(
      RangeError,
    );
  });
});
