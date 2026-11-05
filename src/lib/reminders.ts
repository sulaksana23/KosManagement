function utcDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp / 86_400_000 : null;
}

/** Nilai negatif berarti sebelum jatuh tempo; nilai positif berarti sesudahnya. */
export function getReminderDaysFromDue(
  dueAt: string,
  today: string,
  daysBefore: readonly number[],
  daysAfter: readonly number[],
): number | null {
  const due = utcDay(dueAt);
  const current = utcDay(today);
  if (due === null || current === null) return null;
  const daysFromDue = current - due;
  if (daysFromDue < 0 && daysBefore.includes(Math.abs(daysFromDue))) return daysFromDue;
  if (daysFromDue > 0 && daysAfter.includes(daysFromDue)) return daysFromDue;
  return null;
}

export function todayInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}
