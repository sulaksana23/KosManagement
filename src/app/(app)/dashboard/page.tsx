import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { ArrowUpRight, BedDouble, Building2, CalendarDays, CircleAlert, Wallet } from "lucide-react";
import { db } from "@/db";
import { expenses, invoices, leases, maintenanceTickets, payments, properties, rooms, tenants } from "@/db/schema";
import { EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import { formatDate, formatIDR, todayISO } from "@/lib/format";
import { requireWorkspace } from "@/server/context";

export default async function DashboardPage() {
  const ctx = await requireWorkspace(["owner", "manager", "finance", "staff"]);
  const canSeeFinance = ctx.role !== "staff";
  const today = todayISO();
  const reminderEnd = new Date(`${today}T00:00:00Z`);
  reminderEnd.setUTCDate(reminderEnd.getUTCDate() + 7);
  const reminderEndDate = reminderEnd.toISOString().slice(0, 10);
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+08:00`);
  const monthEnd = new Date(`${nextMonth}T00:00:00+08:00`);
  const ticketFilter = and(
    eq(maintenanceTickets.organizationId, ctx.organizationId),
    sql`${maintenanceTickets.status} not in ('completed','rejected')`,
    ...(ctx.role === "staff" ? [eq(maintenanceTickets.assignedMemberId, ctx.memberId)] : []),
  );
  const [propertyCount, roomCounts, incomeRows, expenseRows, overdueRows, dueSoonRows, upcomingInvoices, openTickets, openTicketCount] = await Promise.all([
    db.select({ count: sql<string>`count(*)` }).from(properties).where(eq(properties.organizationId, ctx.organizationId)),
    db.select({ status: rooms.status, count: sql<string>`count(*)` }).from(rooms).where(eq(rooms.organizationId, ctx.organizationId)).groupBy(rooms.status),
    canSeeFinance ? db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.organizationId, ctx.organizationId), eq(payments.status, "verified"), gte(payments.paidAt, monthStart), lt(payments.paidAt, monthEnd))) : Promise.resolve([{ total: "0" }]),
    canSeeFinance ? db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(and(eq(expenses.organizationId, ctx.organizationId), gte(expenses.occurredAt, `${today.slice(0, 7)}-01`), lt(expenses.occurredAt, nextMonth))) : Promise.resolve([{ total: "0" }]),
    canSeeFinance ? db.select({ count: sql<string>`count(*)` }).from(invoices).where(and(eq(invoices.organizationId, ctx.organizationId), sql`${invoices.status} in ('unpaid','partial','overdue')`, sql`${invoices.amount} > ${invoices.paidAmount}`, lt(invoices.dueAt, today))) : Promise.resolve([{ count: "0" }]),
    canSeeFinance ? db.select({ count: sql<string>`count(*)` }).from(invoices).where(and(eq(invoices.organizationId, ctx.organizationId), sql`${invoices.status} in ('unpaid','partial','overdue')`, sql`${invoices.amount} > ${invoices.paidAmount}`, gte(invoices.dueAt, today), lte(invoices.dueAt, reminderEndDate))) : Promise.resolve([{ count: "0" }]),
    canSeeFinance ? db.select({
      id: invoices.id,
      dueAt: invoices.dueAt,
      amount: invoices.amount,
      paidAmount: invoices.paidAmount,
      tenantName: tenants.fullName,
      roomCode: rooms.code,
    }).from(invoices)
      .innerJoin(leases, eq(invoices.leaseId, leases.id))
      .innerJoin(tenants, eq(leases.tenantId, tenants.id))
      .innerJoin(rooms, eq(leases.roomId, rooms.id))
      .where(and(
        eq(invoices.organizationId, ctx.organizationId),
        eq(leases.organizationId, ctx.organizationId),
        eq(tenants.organizationId, ctx.organizationId),
        eq(rooms.organizationId, ctx.organizationId),
        sql`${invoices.status} in ('unpaid','partial','overdue')`,
        sql`${invoices.amount} > ${invoices.paidAmount}`,
        gte(invoices.dueAt, today),
        lte(invoices.dueAt, reminderEndDate),
      ))
      .orderBy(invoices.dueAt)
      .limit(5) : Promise.resolve([]),
    db.select({ id: maintenanceTickets.id, category: maintenanceTickets.category, priority: maintenanceTickets.priority, status: maintenanceTickets.status, createdAt: maintenanceTickets.createdAt })
      .from(maintenanceTickets).where(ticketFilter).orderBy(desc(maintenanceTickets.createdAt)).limit(5),
    db.select({ count: sql<string>`count(*)` }).from(maintenanceTickets).where(ticketFilter),
  ]);
  const counts = Object.fromEntries(roomCounts.map((item) => [item.status, Number(item.count)]));
  const totalRooms = roomCounts.reduce((sum, item) => sum + Number(item.count), 0);
  const occupied = counts.occupied ?? 0;
  const occupancy = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0;
  const income = incomeRows[0]?.total ?? "0";
  const expenseTotal = expenseRows[0]?.total ?? "0";

  return <div className="page-stack">
    <PageHeading title={`Selamat datang, ${ctx.userName.split(" ")[0]}`} description="Ringkasan operasional properti Anda hari ini." action={<span className="badge badge-green">Workspace aktif</span>} />
    <section className="metric-grid">
      {ctx.role !== "staff" && <Metric label="Properti aktif" value={String(propertyCount[0]?.count ?? 0)} note="lokasi dikelola" icon={<Building2 size={17} />} />}
      <Metric label="Total kamar" value={String(totalRooms)} note={`${counts.available ?? 0} tersedia · ${counts.maintenance ?? 0} perawatan`} icon={<BedDouble size={17} />} />
      <Metric label="Tingkat hunian" value={`${occupancy}%`} note={`${occupied} dari ${totalRooms} kamar`} icon={<ArrowUpRight size={17} />} />
      {canSeeFinance && <Metric label="Pemasukan bulan ini" value={formatIDR(income)} note={`${formatIDR(expenseTotal)} biaya tercatat`} icon={<Wallet size={17} />} />}
    </section>
    <section className="content-grid">
      <div className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="surface-title m-0">Kondisi kamar</h2><p className="muted mb-0 mt-1 text-xs">Status aktual dari data properti</p></div><a className="text-xs font-semibold text-[#39795a]" href="/rooms">Lihat kamar</a></div>
        {totalRooms === 0 ? <EmptyState title="Belum ada kamar" description="Tambahkan properti dan kamar untuk melihat okupansi." /> : <div className="grid gap-3">
          {([["occupied", "Dihuni", "bg-[#438363]"], ["available", "Tersedia", "bg-[#d9b97c]"], ["maintenance", "Perawatan", "bg-[#9ca9a3]"], ["reserved", "Dipesan", "bg-[#7c8cbb]"]] as const).map(([key, label, color]) => {
            const count = counts[key] ?? 0;
            return <div key={key} className="grid grid-cols-[90px_1fr_28px] items-center gap-3"><span className="text-xs text-[#52635c]">{label}</span><div className="h-2 overflow-hidden rounded-full bg-[#eef2f0]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(totalRooms ? (count / totalRooms) * 100 : 0, count ? 2 : 0)}%` }} /></div><span className="text-right text-xs font-semibold">{count}</span></div>;
          })}
        </div>}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#eef2f0] pt-4 sm:grid-cols-3">
          {canSeeFinance && <div><p className="muted m-0 text-[11px]">Tagihan lewat jatuh tempo</p><p className="mb-0 mt-1 flex items-center gap-1.5 text-lg font-bold"><CircleAlert size={15} className="text-[#b75a4b]" />{overdueRows[0]?.count ?? "0"}</p></div>}
          {canSeeFinance && <div><p className="muted m-0 text-[11px]">Jatuh tempo 7 hari</p><p className="mb-0 mt-1 flex items-center gap-1.5 text-lg font-bold"><CalendarDays size={15} className="text-[#98743a]" />{dueSoonRows[0]?.count ?? "0"}</p></div>}
          <div><p className="muted m-0 text-[11px]">Keluhan belum selesai</p><p className="mb-0 mt-1 text-lg font-bold">{openTicketCount[0]?.count ?? "0"}</p></div>
        </div>
      </div>
      <div className="surface p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="surface-title m-0">Keluhan terbaru</h2><p className="muted mb-0 mt-1 text-xs">Tiket yang perlu dipantau</p></div><a className="text-xs font-semibold text-[#39795a]" href="/maintenance">Semua tiket</a></div>
        {openTickets.length === 0 ? <EmptyState title="Tidak ada keluhan terbuka" description="Keluhan baru dari penghuni akan muncul di sini." /> : openTickets.map((ticket) => <div key={ticket.id} className="list-card"><div className="min-w-0"><p className="m-0 truncate text-xs font-semibold">{ticket.category}</p><p className="muted mb-0 mt-1 text-[10px]">{formatDate(ticket.createdAt)}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={ticket.priority} /><StatusBadge status={ticket.status} /></div></div>)}
      </div>
    </section>
    {canSeeFinance && <section className="surface p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="surface-title m-0">Pengingat tagihan</h2><p className="muted mb-0 mt-1 text-xs">Tagihan belum lunas dengan tenggat dalam 7 hari</p></div><a className="text-xs font-semibold text-[#39795a]" href="/billing">Buka tagihan</a></div>
      {upcomingInvoices.length === 0 ? <EmptyState title="Tidak ada tagihan mendekati jatuh tempo" description="Tagihan yang perlu dibayar akan muncul di sini." /> : <div className="grid gap-2">
        {upcomingInvoices.map((invoice) => {
          const daysRemaining = Math.round((Date.parse(`${invoice.dueAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
          return <div key={invoice.id} className="list-card">
            <div className="min-w-0"><p className="m-0 truncate text-xs font-semibold">{invoice.tenantName} · Kamar {invoice.roomCode}</p><p className="muted mb-0 mt-1 text-[10px]">{daysRemaining === 0 ? "Jatuh tempo hari ini" : `Jatuh tempo ${formatDate(invoice.dueAt)}`}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><span className="text-[10px] font-semibold text-[#755b28]">{daysRemaining === 0 ? "Hari ini" : `${daysRemaining} hari lagi`}</span><strong className="text-xs">{formatIDR(String(BigInt(invoice.amount) - BigInt(invoice.paidAmount)))}</strong></div>
          </div>;
        })}
      </div>}
    </section>}
  </div>;
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className="surface metric-card"><div className="flex items-center justify-between"><span className="metric-label">{label}</span><span className="grid size-8 place-items-center rounded-lg bg-[#eaf3ed] text-[#438363]">{icon}</span></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}
