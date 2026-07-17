import { describe, it, expect } from "vitest";
import {
  getEstNow,
  getEstDateISO,
  isWeekend,
  isTradingDay,
  isAtOrAfterEstTime,
} from "./market-calendar";

describe("isWeekend", () => {
  it("is false for a weekday", () => {
    // 2026-07-09 is a Thursday
    expect(isWeekend(new Date(2026, 6, 9))).toBe(false);
  });

  it("is true for a Saturday", () => {
    // 2026-07-11 is a Saturday
    expect(isWeekend(new Date(2026, 6, 11))).toBe(true);
  });

  it("is true for a Sunday", () => {
    // 2026-07-12 is a Sunday
    expect(isWeekend(new Date(2026, 6, 12))).toBe(true);
  });
});

describe("isTradingDay", () => {
  it("is true on a normal weekday with no holiday", () => {
    const date = new Date(2026, 6, 9); // Thursday
    expect(isTradingDay("2026-07-09", date)).toBe(true);
  });

  it("is false on a weekend", () => {
    const date = new Date(2026, 6, 11); // Saturday
    expect(isTradingDay("2026-07-11", date)).toBe(false);
  });

  it("is false on a listed NYSE holiday even though it's a weekday", () => {
    // 2026-07-03 is a Friday, listed as observed Independence Day
    const date = new Date(2026, 6, 3);
    expect(isTradingDay("2026-07-03", date)).toBe(false);
  });

  it("is false on another year's listed holiday", () => {
    // 2027-07-05 is a Monday, listed as observed Independence Day
    const date = new Date(2027, 6, 5);
    expect(isTradingDay("2027-07-05", date)).toBe(false);
  });
});

describe("isAtOrAfterEstTime", () => {
  it("is false one minute before the target time", () => {
    const date = new Date(2026, 6, 9, 16, 44);
    expect(isAtOrAfterEstTime(16, 45, date)).toBe(false);
  });

  it("is true exactly at the target time", () => {
    const date = new Date(2026, 6, 9, 16, 45);
    expect(isAtOrAfterEstTime(16, 45, date)).toBe(true);
  });

  it("is true one minute after the target time", () => {
    const date = new Date(2026, 6, 9, 16, 46);
    expect(isAtOrAfterEstTime(16, 45, date)).toBe(true);
  });

  it("is true well past the target time", () => {
    const date = new Date(2026, 6, 9, 23, 0);
    expect(isAtOrAfterEstTime(16, 45, date)).toBe(true);
  });

  it("is false well before the target time", () => {
    const date = new Date(2026, 6, 9, 0, 0);
    expect(isAtOrAfterEstTime(16, 45, date)).toBe(false);
  });
});

describe("getEstNow / getEstDateISO", () => {
  it("getEstNow returns a valid Date", () => {
    expect(getEstNow()).toBeInstanceOf(Date);
    expect(Number.isNaN(getEstNow().getTime())).toBe(false);
  });

  it("getEstDateISO returns a YYYY-MM-DD string", () => {
    expect(getEstDateISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
