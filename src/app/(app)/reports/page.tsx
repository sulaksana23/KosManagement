import { and, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { BarChart3, Download } from "lucide-react";
import { db } from "@/db";
import { expenses, invoices, leases, payments, properties, rooms } from "@/db/schema";
import { PageHeading, SelectField, StatusBadge, TextField } from "@/components/ui";
import { formatIDR, todayISO } from "@/lib/format";
import { requireWorkspace } from "@/server/context";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; propertyId?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const params = await searchParams;
  const today = todayISO();
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const range = z.object({ from: z.iso.date(), to: z.iso.date() }).refine((value) => value.from <= value.to).safeParse({
    from: params.from ?? defaultFrom, to: params.to ?? today,
  });
  const from = range.success ? range.data.from : defaultFrom;
  const to = range.success ? range.data.to : today;
  const [propertyList] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).where(eq(properties.organizationId, ctx.organizationId)).orderBy(properties.name),
  ]);
  const propertyId = propertyList.some((property) => property.id === params.propertyId) ? params.propertyId! : "";
  const startAt = new Date(`${from}T00:00:00+08:00`);
  const endExclusive = new Date(`${to}T00:00:00+08:00`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const endDateExclusive = new Date(`${to}T00:00:00Z`);
  endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
  const endDate = endDateExclusive.toISOString().slice(0, 10);
  const roomWhere = and(eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId), propertyId ? eq(properties.id, propertyId) : undefined);
  const [income, cost, occupancy] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id)).innerJoin(leases, eq(invoices.leaseId, leases.id))
      .innerJoin(rooms, eq(leases.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(eq(payments.organizationId, ctx.organizationId), eq(invoices.organizationId, ctx.organizationId), eq(leases.organizationId, ctx.organizationId), eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId), eq(payments.status, "verified"), gte(payments.paidAt, startAt), lt(payments.paidAt, endExclusive), propertyId ? eq(properties.id, propertyId) : undefined)),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).innerJoin(properties, eq(expenses.propertyId, properties.id))
      .where(and(eq(expenses.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId), gte(expenses.occurredAt, from), lt(expenses.occurredAt, endDate), propertyId ? eq(properties.id, propertyId) : undefined)),
    db.select({ status: rooms.status, count: sql<string>`count(*)` }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(roomWhere).groupBy(rooms.status),
  ]);
  const roomsTotal = occupancy.reduce((sum, row) => sum + Number(row.count), 0);
  const occupied = Number(occupancy.find((row) => row.status === "occupied")?.count ?? 0);
  const rate = roomsTotal ? Math.round((occupied / roomsTotal) * 100) : 0;
  const common = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : ""}`;
  return <div className="page-stack">
    <PageHeading title="Laporan" description="Ringkasan transaksi menurut periode dan properti yang dipilih." />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3">
      <TextField name="from" label="Dari tanggal" type="date" defaultValue={from} required />
      <TextField name="to" label="Sampai tanggal" type="date" defaultValue={to} required />
      <SelectField name="propertyId" label="Properti" defaultValue={propertyId} options={[{ value: "", label: "Semua properti" }, ...propertyList.map((property) => ({ value: property.id, label: property.name }))]} />
      <button className="btn btn-secondary">Terapkan filter</button>
      <a className="btn btn-quiet" href="/reports">Reset</a>
    </form>
    <section className="metric-grid">
      <div className="surface metric-card"><div className="metric-label">Pemasukan terverifikasi</div><div className="metric-value">{formatIDR(income[0]?.total ?? "0")}</div><div className="metric-note">Pembayaran masuk antara {from} dan {to}.</div></div>
      <div className="surface metric-card"><div className="metric-label">Biaya operasional</div><div className="metric-value">{formatIDR(cost[0]?.total ?? "0")}</div><div className="metric-note">Berdasarkan tanggal transaksi biaya.</div></div>
      <div className="surface metric-card"><div className="metric-label">Tingkat hunian saat ini</div><div className="metric-value">{rate}%</div><div className="metric-note">{occupied} kamar dihuni dari {roomsTotal} kamar yang difilter.</div></div>
      <div className="surface metric-card"><div className="metric-label">Periode transaksi</div><div className="metric-value text-xl">{from} – {to}</div><div className="metric-note">Zona waktu tanggal: Asia/Makassar.</div></div>
    </section>
    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3"><div className="grid size-9 place-items-center rounded-lg bg-[#eaf3ed] text-[#438363]"><BarChart3 size={18} /></div><div><h2 className="surface-title m-0">Unduh CSV</h2><p className="muted mb-0 mt-1 text-xs">Setiap file memuat transaksi sumber dengan filter properti dan rentang tanggal yang sama.</p></div></div>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-secondary" href={`/api/reports/csv?type=income&${common}`}><Download size={15} />Pemasukan</a>
        <a className="btn btn-secondary" href={`/api/reports/csv?type=expenses&${common}`}><Download size={15} />Pengeluaran</a>
        <a className="btn btn-secondary" href={`/api/reports/csv?type=occupancy${propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : ""}`}><Download size={15} />Okupansi</a>
      </div>
    </section>
    <section className="surface overflow-hidden">
      <div className="border-b border-[#e8eeeb] px-4 py-3"><h2 className="surface-title m-0">Rincian status kamar</h2></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>STATUS</th><th>JUMLAH KAMAR</th></tr></thead><tbody>{occupancy.length === 0 ? <tr><td colSpan={2} className="text-center text-[#71817b]">Belum ada data kamar.</td></tr> : occupancy.map((row) => <tr key={row.status}><td><StatusBadge status={row.status} /></td><td>{row.count}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
