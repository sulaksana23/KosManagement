import { and, eq, gte, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { expenses, invoices, leases, members, payments, properties, rooms, tenants } from "@/db/schema";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

function csvCell(input: string | number | null | undefined) {
  let value = String(input ?? "");
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replaceAll('"', '""')}"`;
}

function csv(rows: (string | number | null | undefined)[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Anda harus masuk." }, { status: 401 });
  const [membership] = await db.select({ organizationId: members.organizationId, role: members.role }).from(members).where(eq(members.userId, session.user.id)).limit(1);
  if (!membership) return NextResponse.json({ error: "Workspace belum tersedia." }, { status: 403 });

  const query = request.nextUrl.searchParams;
  const type = z.enum(["income", "expenses", "occupancy"]).safeParse(query.get("type"));
  if (!type.success) return NextResponse.json({ error: "Jenis laporan tidak valid." }, { status: 400 });
  if (!["owner", "manager", "finance"].includes(membership.role)) return NextResponse.json({ error: "Anda tidak memiliki akses laporan." }, { status: 403 });
  const from = query.get("from") ?? "", to = query.get("to") ?? "", propertyId = query.get("propertyId") ?? "";
  if (type.data !== "occupancy" && (!z.iso.date().safeParse(from).success || !z.iso.date().safeParse(to).success || from > to)) {
    return NextResponse.json({ error: "Rentang tanggal tidak valid." }, { status: 400 });
  }
  if (propertyId) {
    const [property] = await db.select({ id: properties.id }).from(properties).where(and(eq(properties.id, propertyId), eq(properties.organizationId, membership.organizationId))).limit(1);
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan." }, { status: 404 });
  }

  let contents: string;
  let filename: string;
  if (type.data === "income") {
    const start = new Date(`${from}T00:00:00+08:00`), endExclusive = new Date(`${to}T00:00:00+08:00`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const data = await db.select({ payment: payments, tenant: tenants.fullName, room: rooms.code, property: properties.name, period: invoices.periodStart })
      .from(payments).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).innerJoin(leases, eq(invoices.leaseId, leases.id))
      .innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(eq(payments.organizationId, membership.organizationId), eq(invoices.organizationId, membership.organizationId), eq(leases.organizationId, membership.organizationId), eq(tenants.organizationId, membership.organizationId), eq(rooms.organizationId, membership.organizationId), eq(properties.organizationId, membership.organizationId), propertyId ? eq(properties.id, propertyId) : undefined, eq(payments.status, "verified"), gte(payments.paidAt, start), lt(payments.paidAt, endExclusive))).limit(10000);
    contents = csv([["tanggal", "properti", "kamar", "penghuni", "periode_tagihan", "metode", "referensi", "nominal", "status"], ...data.map(({ payment, tenant, room, property, period }) => [payment.paidAt.toISOString(), property, room, tenant, period, payment.method, payment.reference, payment.amount, payment.status])]);
    filename = `pemasukan-${from}-${to}.csv`;
  } else if (type.data === "expenses") {
    const endExclusive = new Date(`${to}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endDate = endExclusive.toISOString().slice(0, 10);
    const data = await db.select({ expense: expenses, property: properties.name }).from(expenses).innerJoin(properties, eq(expenses.propertyId, properties.id))
      .where(and(eq(expenses.organizationId, membership.organizationId), eq(properties.organizationId, membership.organizationId), propertyId ? eq(properties.id, propertyId) : undefined, gte(expenses.occurredAt, from), lt(expenses.occurredAt, endDate))).limit(10000);
    contents = csv([["tanggal", "properti", "kategori", "pemasok", "catatan", "nominal"], ...data.map(({ expense, property }) => [expense.occurredAt, property, expense.category, expense.vendor, expense.note, expense.amount])]);
    filename = `pengeluaran-${from}-${to}.csv`;
  } else {
    const data = await db.select({ room: rooms, property: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(and(eq(rooms.organizationId, membership.organizationId), eq(properties.organizationId, membership.organizationId), propertyId ? eq(properties.id, propertyId) : undefined)).orderBy(properties.name, rooms.code).limit(10000);
    contents = csv([["properti", "kamar", "tipe", "status", "sewa_bulanan", "deposit"], ...data.map(({ room, property }) => [property, room.code, room.type, room.status, room.monthlyRent, room.deposit])]);
    filename = "okupansi-kamar.csv";
  }
  return new NextResponse(`\uFEFF${contents}`, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  } });
}
