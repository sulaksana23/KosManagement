import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, leases, maintenanceTickets, members, payments, privateFiles, tenants } from "@/db/schema";
import { getServerSession } from "@/server/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Masuk untuk melihat lampiran." }, { status: 401 });
  const { fileId } = await params;
  const [member] = await db.select({ id: members.id, organizationId: members.organizationId, role: members.role })
    .from(members).where(eq(members.userId, session.user.id)).limit(1);
  if (!member) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const [file] = await db.select().from(privateFiles).where(and(
    eq(privateFiles.id, fileId), eq(privateFiles.organizationId, member.organizationId),
  )).limit(1);
  if (!file) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });

  let allowed = false;
  if (file.paymentId) {
    const [payment] = await db.select({ id: payments.id, tenantId: leases.tenantId }).from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id)).innerJoin(leases, eq(invoices.leaseId, leases.id)).where(and(
        eq(payments.id, file.paymentId), eq(payments.organizationId, member.organizationId),
        eq(invoices.organizationId, member.organizationId), eq(leases.organizationId, member.organizationId),
      )).limit(1);
    if (!payment) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (["owner", "manager", "finance"].includes(member.role)) {
      allowed = true;
    } else if (member.role === "tenant") {
      const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(and(
        eq(tenants.organizationId, member.organizationId), eq(tenants.userId, session.user.id),
      )).limit(1);
      allowed = tenant?.id === payment.tenantId;
    }
  } else if (file.ticketId) {
    const [ticket] = await db.select({ id: maintenanceTickets.id, assignedMemberId: maintenanceTickets.assignedMemberId, tenantId: maintenanceTickets.tenantId }).from(maintenanceTickets).where(and(
      eq(maintenanceTickets.id, file.ticketId), eq(maintenanceTickets.organizationId, member.organizationId),
    )).limit(1);
    if (!ticket) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (member.role === "owner" || member.role === "manager") {
      allowed = true;
    } else if (member.role === "staff") {
      allowed = ticket.assignedMemberId === member.id;
    } else if (member.role === "tenant") {
      const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(and(
        eq(tenants.organizationId, member.organizationId), eq(tenants.userId, session.user.id),
      )).limit(1);
      allowed = tenant?.id === ticket.tenantId;
    }
  }
  if (!allowed) return NextResponse.json({ error: "Tidak diizinkan melihat lampiran ini." }, { status: 403 });
  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `inline; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
