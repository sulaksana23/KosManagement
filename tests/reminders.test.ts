import assert from "node:assert/strict";
import test from "node:test";
import { getReminderDaysFromDue, todayInTimezone } from "../src/lib/reminders";

test("pengingat memilih jadwal sebelum dan sesudah jatuh tempo", () => {
  assert.equal(getReminderDaysFromDue("2026-11-10", "2026-11-07", [3], [1, 7]), -3);
  assert.equal(getReminderDaysFromDue("2026-11-10", "2026-11-11", [3], [1, 7]), 1);
  assert.equal(getReminderDaysFromDue("2026-11-10", "2026-11-17", [3], [1, 7]), 7);
  assert.equal(getReminderDaysFromDue("2026-11-10", "2026-11-10", [3], [1, 7]), null);
  assert.equal(getReminderDaysFromDue("2026-11-10", "2026-11-08", [3], [1, 7]), null);
});

test("tanggal pengingat mengikuti zona waktu properti", () => {
  const now = new Date("2026-11-04T18:30:00.000Z");
  assert.equal(todayInTimezone(now, "Asia/Makassar"), "2026-11-05");
  assert.equal(todayInTimezone(now, "America/Los_Angeles"), "2026-11-04");
});
