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

// True once the current ET wall-clock time is at or after hour:minute.
//
// GitHub Actions cron has no DST awareness, so workflows that need a fixed
// ET fire time schedule two UTC crons an hour apart and rely on one landing
// correctly each season. The other one still fires — but at the *wrong*
// season it lands up to an hour early, not late. Callers on that dual-cron
// pattern should guard their real work behind this check (using their
// intended local time) so the early, DST-shifted firing is a clean no-op
// instead of racing the correctly-timed firing with stale state.
export function isAtOrAfterEstTime(hour: number, minute: number, date: Date = getEstNow()): boolean {
  return date.getHours() * 60 + date.getMinutes() >= hour * 60 + minute;
}
