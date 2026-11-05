import "server-only";
import { and, eq, gte, inArray, lte, lt, or, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { invoiceReminderLogs, invoices, leases, organizations, payments, properties, rooms, tenants } from "@/db/schema";
import { id } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { getReminderDaysFromDue, todayInTimezone } from "@/lib/reminders";

function shiftDay(value: string, delta: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export async function sendInvoiceReminders(now = new Date()) {
  const rows = await db.select({
    invoice: invoices,
    tenantName: tenants.fullName,
    tenantEmail: tenants.email,
    roomCode: rooms.code,
    propertyName: properties.name,
    timezone: properties.timezone,
    organizationName: organizations.name,
    remindersEnabled: organizations.remindersEnabled,
    daysBefore: organizations.reminderDaysBefore,
    daysAfter: organizations.reminderDaysAfter,
  }).from(invoices)
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
    .innerJoin(leases, eq(invoices.leaseId, leases.id))
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .innerJoin(rooms, eq(leases.roomId, rooms.id))
    .innerJoin(properties, eq(rooms.propertyId, properties.id))
    .where(and(
      eq(invoices.organizationId, leases.organizationId),
      eq(invoices.organizationId, tenants.organizationId),
      eq(invoices.organizationId, rooms.organizationId),
      eq(invoices.organizationId, properties.organizationId),
      or(eq(invoices.status, "unpaid"), eq(invoices.status, "partial"), eq(invoices.status, "overdue")),
      gte(invoices.dueAt, shiftDay(todayInTimezone(now, "UTC"), -31)),
      lte(invoices.dueAt, shiftDay(todayInTimezone(now, "UTC"), 31)),
    )).orderBy(invoices.dueAt).limit(2000);

  const result = { scanned: rows.length, eligible: 0, sent: 0, failed: 0, skipped: 0 };
  const pendingRows = rows.length ? await db.select({ invoiceId: invoices.id, total: sum(payments.amount) })
    .from(payments).innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.organizationId, invoices.organizationId), eq(payments.status, "pending"), inArray(invoices.id, rows.map((row) => row.invoice.id))))
    .groupBy(invoices.id) : [];
  const pendingByInvoice = new Map(pendingRows.map((item) => [item.invoiceId, BigInt(item.total ?? "0")]));
  for (const row of rows) {
    const remaining = BigInt(row.invoice.amount) - BigInt(row.invoice.paidAmount) - (pendingByInvoice.get(row.invoice.id) ?? BigInt(0));
    if (!row.remindersEnabled || !row.tenantEmail || remaining <= BigInt(0)) {
      result.skipped++;
      continue;
    }
    const today = todayInTimezone(now, row.timezone);
    const daysFromDue = getReminderDaysFromDue(row.invoice.dueAt, today, row.daysBefore, row.daysAfter);
    if (daysFromDue === null) continue;
    result.eligible++;

    const key = { invoiceId: row.invoice.id, daysFromDue, scheduledFor: today };
    const staleBefore = new Date(now.getTime() - 30 * 60 * 1000);
    let claimId: string | undefined;
    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(invoiceReminderLogs).values({
        id: id(), organizationId: row.invoice.organizationId, ...key, status: "processing", attemptCount: 1,
      }).onConflictDoNothing().returning({ id: invoiceReminderLogs.id });
      if (inserted) {
        claimId = inserted.id;
        return;
      }
      const [retried] = await tx.update(invoiceReminderLogs).set({
        status: "processing", attemptCount: sql`${invoiceReminderLogs.attemptCount} + 1`, updatedAt: now, lastError: null,
      }).where(and(
        eq(invoiceReminderLogs.invoiceId, key.invoiceId), eq(invoiceReminderLogs.daysFromDue, key.daysFromDue),
        eq(invoiceReminderLogs.scheduledFor, key.scheduledFor),
        or(eq(invoiceReminderLogs.status, "failed"), and(eq(invoiceReminderLogs.status, "processing"), lt(invoiceReminderLogs.updatedAt, staleBefore))),
      )).returning({ id: invoiceReminderLogs.id });
      claimId = retried?.id;
    });
    if (!claimId) continue;

    const relativeDate = daysFromDue < 0 ? `jatuh tempo dalam ${Math.abs(daysFromDue)} hari` : daysFromDue === 0 ? "jatuh tempo hari ini" : `terlambat ${daysFromDue} hari`;
    const message = `Halo ${row.tenantName}, ini pengingat tagihan kos di ${row.organizationName}, ${row.propertyName}, kamar ${row.roomCode}. Tagihan periode ${row.invoice.periodStart} sebesar Rp${remaining.toString()} ${relativeDate}. Jika Anda sudah mengirim konfirmasi, abaikan pengingat ini; pengelola akan memeriksanya. Terima kasih.`;
    try {
      const sent = await sendEmail({
        to: row.tenantEmail,
        subject: "Pengingat tagihan KosManager",
        text: message,
        idempotencyKey: `invoice-reminder-${row.invoice.organizationId}-${row.invoice.id}-${daysFromDue}-${today}`,
      });
      if (!sent) throw new Error("EMAIL_NOT_CONFIGURED");
      await db.update(invoiceReminderLogs).set({ status: "sent", sentAt: now, updatedAt: now, lastError: null })
        .where(eq(invoiceReminderLogs.id, claimId));
      result.sent++;
    } catch (error) {
      await db.update(invoiceReminderLogs).set({ status: "failed", updatedAt: now, lastError: error instanceof Error ? error.message.slice(0, 250) : "EMAIL_PROVIDER_FAILED" })
        .where(eq(invoiceReminderLogs.id, claimId));
      result.failed++;
    }
  }
  return result;
}
