import { and, eq, gte, lt, sql } from "drizzle-orm";
import { BarChart3, Download } from "lucide-react";
import { db } from "@/db";
import { expenses, payments, rooms } from "@/db/schema";
import { PageHeading, StatusBadge } from "@/components/ui";
import { formatIDR, todayISO } from "@/lib/format";
import { requireWorkspace } from "@/server/context";

export default async function ReportsPage() {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const today = todayISO();
  const from = `${today.slice(0, 7)}-01`;
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const to = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const startAt = new Date(`${from}T00:00:00+08:00`), endAt = new Date(`${to}T00:00:00+08:00`);
  const [income, cost, occupancy] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.organizationId, ctx.organizationId), eq(payments.status, "verified"), gte(payments.paidAt, startAt), lt(payments.paidAt, endAt))),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(and(eq(expenses.organizationId, ctx.organizationId), gte(expenses.occurredAt, from), lt(expenses.occurredAt, to))),
    db.select({ status: rooms.status, count: sql<string>`count(*)` }).from(rooms).where(eq(rooms.organizationId, ctx.organizationId)).groupBy(rooms.status),
  ]);
  const roomsTotal = occupancy.reduce((sum, row) => sum + Number(row.count), 0);
  const occupied = Number(occupancy.find((row) => row.status === "occupied")?.count ?? 0);
  const rate = roomsTotal ? Math.round((occupied / roomsTotal) * 100) : 0;
  return <div className="page-stack">
    <PageHeading title="Laporan" description="Ringkasan berdasarkan pembayaran terverifikasi, biaya, dan status kamar." />
    <section className="metric-grid">
      <div className="surface metric-card"><div className="metric-label">Pemasukan terverifikasi · bulan ini</div><div className="metric-value">{formatIDR(income[0]?.total ?? "0")}</div><div className="metric-note">Tidak menghitung pembayaran yang menunggu verifikasi.</div></div>
      <div className="surface metric-card"><div className="metric-label">Biaya operasional · bulan ini</div><div className="metric-value">{formatIDR(cost[0]?.total ?? "0")}</div><div className="metric-note">Berdasarkan tanggal transaksi biaya.</div></div>
      <div className="surface metric-card"><div className="metric-label">Tingkat hunian</div><div className="metric-value">{rate}%</div><div className="metric-note">{occupied} kamar dihuni dari {roomsTotal} kamar terdaftar.</div></div>
      <div className="surface metric-card"><div className="metric-label">Periode laporan</div><div className="metric-value text-xl">{today.slice(0, 7)}</div><div className="metric-note">Zona waktu workspace: {ctx.organizationName}</div></div>
    </section>
    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3"><div className="grid size-9 place-items-center rounded-lg bg-[#eaf3ed] text-[#438363]"><BarChart3 size={18} /></div><div><h2 className="surface-title m-0">Unduh CSV</h2><p className="muted mb-0 mt-1 text-xs">Ekspor untuk periode bulan ini. Setiap file memuat transaksi sumber, bukan angka ringkasan saja.</p></div></div>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-secondary" href={`/api/reports/csv?type=income&from=${from}&to=${today}`}><Download size={15} />Pemasukan</a>
        <a className="btn btn-secondary" href={`/api/reports/csv?type=expenses&from=${from}&to=${today}`}><Download size={15} />Pengeluaran</a>
        <a className="btn btn-secondary" href={`/api/reports/csv?type=occupancy`}><Download size={15} />Okupansi</a>
      </div>
    </section>
    <section className="surface overflow-hidden">
      <div className="border-b border-[#e8eeeb] px-4 py-3"><h2 className="surface-title m-0">Rincian status kamar</h2></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>STATUS</th><th>JUMLAH KAMAR</th></tr></thead><tbody>{occupancy.length === 0 ? <tr><td colSpan={2} className="text-center text-[#71817b]">Belum ada data kamar.</td></tr> : occupancy.map((row) => <tr key={row.status}><td><StatusBadge status={row.status} /></td><td>{row.count}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
