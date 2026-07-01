import { NYSE_HOLIDAYS } from "@/config/nyse-holidays";

export function getEstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

export function getEstDateISO(): string {
  return getEstNow().toISOString().slice(0, 10);
}

export function isWeekend(date: Date = getEstNow()): boolean {
  const day = date.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

// True on a normal NYSE trading day — no weekend, no market holiday.
export function isTradingDay(id: string = getEstDateISO(), date: Date = getEstNow()): boolean {
  return !isWeekend(date) && !NYSE_HOLIDAYS.has(id);
}
