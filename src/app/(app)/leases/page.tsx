import { and, desc, eq, inArray, or } from "drizzle-orm";
import { FileText, Plus } from "lucide-react";
import { db } from "@/db";
import { auditLogs, leases, properties, rooms, tenants } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, StatusBadge, TextField } from "@/components/ui";
import { createLease, endLease, renewLease } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function LeasesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const today = todayISO();
  const expiryHorizon = addDaysISO(today, 30);
  const [tenantList, roomList, leaseList, auditRows] = await Promise.all([
    db.select({ id: tenants.id, name: tenants.fullName }).from(tenants).where(eq(tenants.organizationId, ctx.organizationId)).orderBy(tenants.fullName),
    db.select({ id: rooms.id, code: rooms.code, rent: rooms.monthlyRent, property: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(and(eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId), or(eq(rooms.status, "available"), eq(rooms.status, "reserved")))).orderBy(properties.name, rooms.code),
    db.select({ lease: leases, tenantName: tenants.fullName, roomCode: rooms.code, propertyName: properties.name }).from(leases)
      .innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(eq(leases.organizationId, ctx.organizationId), eq(tenants.organizationId, ctx.organizationId), eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId))).orderBy(leases.startsAt).limit(100),
    db.select({ action: auditLogs.action, entityId: auditLogs.entityId, changes: auditLogs.changes }).from(auditLogs).where(and(
      eq(auditLogs.organizationId, ctx.organizationId),
      inArray(auditLogs.action, ["lease.renewed", "lease.ended", "lease.renewal_cancelled"]),
    )).orderBy(desc(auditLogs.createdAt)).limit(500),
  ]);
  const renewedLeaseIds = new Set<string>();
  const cancelledRenewalIds = new Set<string>();
  const checkoutByLease = new Map<string, Record<string, unknown>>();
  for (const row of auditRows) {
    if (row.action === "lease.renewal_cancelled" && typeof row.changes?.renewalLeaseId === "string") cancelledRenewalIds.add(row.changes.renewalLeaseId);
    if (row.action === "lease.ended" && row.changes && !checkoutByLease.has(row.entityId)) checkoutByLease.set(row.entityId, row.changes);
  }
  for (const row of auditRows) {
    if (row.action === "lease.renewed" && typeof row.changes?.previousLeaseId === "string" && !cancelledRenewalIds.has(row.entityId)) renewedLeaseIds.add(row.changes.previousLeaseId);
  }
  const expiringCount = leaseList.filter(({ lease }) => lease.status === "active" && lease.endsAt && lease.endsAt >= today && lease.endsAt <= expiryHorizon && !renewedLeaseIds.has(lease.id)).length;
  return <div className="page-stack">
    <PageHeading title="Kontrak sewa" description="Kelola perpanjangan, tanggal keluar, dan penyelesaian kontrak penghuni." action={<div className="flex flex-wrap gap-2"><span className="badge badge-gray">{leaseList.length} kontrak</span>{expiringCount > 0 && <span className="badge badge-amber">{expiringCount} segera berakhir</span>}</div>} />
    <PageNotice notice={params.notice} error={params.error} />
    <FormCard title="Buat kontrak" description="Sistem menolak tanggal yang bertumpuk pada kamar yang sama.">
      {tenantList.length === 0 || roomList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan penghuni dan kamar tersedia terlebih dahulu.</p> : <form action={createLease} className="form-grid">
        <SelectField name="tenantId" label="Penghuni" options={tenantList.map((tenant) => ({ value: tenant.id, label: tenant.name }))} required />
        <SelectField name="roomId" label="Kamar tersedia" options={roomList.map((room) => ({ value: room.id, label: `${room.property} · ${room.code} · ${formatIDR(room.rent)}/bln` }))} required />
        <TextField name="startsAt" label="Tanggal mulai" type="date" defaultValue={today} required />
        <TextField name="endsAt" label="Tanggal akhir (opsional)" type="date" />
        <TextField name="monthlyRent" label="Sewa per bulan (Rp)" type="number" min="0" step="1" required />
        <TextField name="deposit" label="Deposit (Rp)" type="number" min="0" step="1" defaultValue="0" required />
        <TextField name="dueDay" label="Tanggal jatuh tempo setiap bulan" type="number" min="1" max="31" defaultValue="1" required />
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan kontrak</button></div>
      </form>}
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><FileText size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Riwayat kontrak</h2></div>
      {leaseList.length === 0 ? <EmptyState title="Belum ada kontrak" description="Kontrak aktif akan menentukan status huni kamar." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>PENGHUNI</th><th>KAMAR</th><th>PERIODE</th><th>SEWA / BULAN</th><th>JATUH TEMPO</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{leaseList.map(({ lease, tenantName, roomCode, propertyName }) => <tr key={lease.id}><td className="font-semibold">{tenantName}</td><td>{propertyName} · {roomCode}</td><td>{formatDate(lease.startsAt)} – {lease.endsAt ? formatDate(lease.endsAt) : "Tanpa batas akhir"}</td><td>{formatIDR(lease.monthlyRent)}</td><td>Tanggal {lease.dueDay}</td><td><div className="grid justify-items-start gap-1"><StatusBadge status={lease.status} />{lease.status === "active" && lease.endsAt && lease.endsAt >= today && lease.endsAt <= expiryHorizon && <span className="text-[10px] font-medium text-[#755b28]">Berakhir dalam {Math.round((Date.parse(`${lease.endsAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)} hari</span>}</div></td><td><LeaseActions lease={lease} today={today} renewed={renewedLeaseIds.has(lease.id)} checkout={checkoutByLease.get(lease.id) ?? null} /></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

type LeaseRecord = typeof leases.$inferSelect;

function LeaseActions({ lease, today, renewed, checkout }: { lease: LeaseRecord; today: string; renewed: boolean; checkout: Record<string, unknown> | null }) {
  const suffix = lease.id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (lease.status !== "active") {
    if (lease.status !== "ended" || !checkout) return <span className="text-[11px] text-[#82918b]">—</span>;
    return <details>
      <summary className="btn btn-quiet min-h-8 cursor-pointer list-none px-2.5 text-[11px]">Lihat penyelesaian</summary>
      <div className="mt-2 grid min-w-[220px] gap-1 rounded-lg border border-[#e8eeeb] bg-white p-3 text-[11px]">
        <p className="m-0 font-semibold">Tanggal keluar: {typeof checkout.endsAt === "string" ? formatDate(checkout.endsAt) : "—"}</p>
        <p className="m-0">Deposit kembali: {typeof checkout.depositRefunded === "string" ? formatIDR(checkout.depositRefunded) : "—"}</p>
        <p className="m-0">Deposit ditahan: {typeof checkout.depositWithheld === "string" ? formatIDR(checkout.depositWithheld) : "—"}</p>
        <p className="m-0">Meter listrik akhir: {typeof checkout.finalElectricityReading === "string" ? checkout.finalElectricityReading : "—"}</p>
        <p className="m-0">Meter air akhir: {typeof checkout.finalWaterReading === "string" ? checkout.finalWaterReading : "—"}</p>
        {typeof checkout.note === "string" && <p className="m-0">Catatan: {checkout.note}</p>}
      </div>
    </details>;
  }

  if (lease.startsAt > today) {
    return <form action={endLease}>
      <input type="hidden" name="leaseId" value={lease.id} />
      <ConfirmSubmitButton className="btn btn-quiet" message="Batalkan kontrak yang belum dimulai?" label="Batalkan kontrak" />
    </form>;
  }

  return <div className="grid min-w-[190px] gap-2">
    {renewed && <span className="badge badge-green w-fit">Perpanjangan dicatat</span>}
    {lease.endsAt && lease.endsAt >= today && !renewed && <details>
      <summary className="btn btn-quiet min-h-8 cursor-pointer list-none px-2.5 text-[11px]">Perpanjang kontrak</summary>
      <form action={renewLease} className="mt-2 grid gap-2 rounded-lg border border-[#e8eeeb] bg-white p-3">
        <input type="hidden" name="leaseId" value={lease.id} />
        <label className="grid gap-1 text-[11px] font-medium text-[#52635c]" htmlFor={`renew-end-${suffix}`}>Tanggal akhir baru</label>
        <input className="input min-h-8 px-2 py-1 text-xs" id={`renew-end-${suffix}`} name="endsAt" type="date" min={addDaysISO(lease.endsAt, 1)} defaultValue={addYearsISO(lease.endsAt, 1)} required />
        <label className="grid gap-1 text-[11px] font-medium text-[#52635c]" htmlFor={`renew-rent-${suffix}`}>Sewa per bulan (Rp)</label>
        <input className="input min-h-8 px-2 py-1 text-xs" id={`renew-rent-${suffix}`} name="monthlyRent" type="number" min="1" step="1" defaultValue={lease.monthlyRent} required />
        <label className="grid gap-1 text-[11px] font-medium text-[#52635c]" htmlFor={`renew-deposit-${suffix}`}>Deposit (Rp)</label>
        <input className="input min-h-8 px-2 py-1 text-xs" id={`renew-deposit-${suffix}`} name="deposit" type="number" min="0" step="1" defaultValue={lease.deposit} required />
        <label className="grid gap-1 text-[11px] font-medium text-[#52635c]" htmlFor={`renew-due-${suffix}`}>Tanggal jatuh tempo</label>
        <input className="input min-h-8 px-2 py-1 text-xs" id={`renew-due-${suffix}`} name="dueDay" type="number" min="1" max="31" defaultValue={lease.dueDay} required />
        <button className="btn btn-primary">Simpan perpanjangan</button>
      </form>
    </details>}
    <details>
      <summary className="btn btn-quiet min-h-8 cursor-pointer list-none px-2.5 text-[11px]">Proses penghuni keluar</summary>
      <form action={endLease} className="mt-2 grid gap-2 rounded-lg border border-[#e8eeeb] bg-white p-3">
        <input type="hidden" name="leaseId" value={lease.id} />
        <label className="grid gap-1 text-[11px] font-medium text-[#52635c]" htmlFor={`checkout-date-${suffix}`}>Tanggal keluar</label>
        <input className="input min-h-8 px-2 py-1 text-xs" id={`checkout-date-${suffix}`} name="checkoutDate" type="date" min={lease.startsAt} max={today} defaultValue={today} required />
        <label className="grid gap-1 text-[11px] font-medium text-[#52635c]" htmlFor={`checkout-refund-${suffix}`}>Deposit dikembalikan (Rp)</label>
        <input className="input min-h-8 px-2 py-1 text-xs" id={`checkout-refund-${suffix}`} name="depositRefunded" type="number" min="0" max={lease.deposit} step="1" defaultValue={lease.deposit} required />
        <div className="grid grid-cols-2 gap-2">
          <div className="grid content-start gap-1"><label className="text-[11px] font-medium text-[#52635c]" htmlFor={`checkout-electricity-${suffix}`}>Meter listrik akhir</label><input className="input min-h-8 px-2 py-1 text-xs" id={`checkout-electricity-${suffix}`} name="finalElectricity" type="number" min="0" step="0.001" /></div>
          <div className="grid content-start gap-1"><label className="text-[11px] font-medium text-[#52635c]" htmlFor={`checkout-water-${suffix}`}>Meter air akhir</label><input className="input min-h-8 px-2 py-1 text-xs" id={`checkout-water-${suffix}`} name="finalWater" type="number" min="0" step="0.001" /></div>
        </div>
        <label className="grid gap-1 text-[11px] font-medium text-[#52635c]" htmlFor={`checkout-note-${suffix}`}>Catatan penyelesaian</label>
        <textarea className="input min-h-16 px-2 py-1 text-xs" id={`checkout-note-${suffix}`} name="checkoutNote" maxLength={500} placeholder="Wajib diisi jika sebagian deposit ditahan." />
        <ConfirmSubmitButton className="btn btn-primary" message="Simpan proses penghuni keluar dan perbarui status kamar?" label="Simpan proses keluar" />
      </form>
    </details>
  </div>;
}

function addDaysISO(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addYearsISO(value: string, years: number) {
  const [year, month, day] = value.split("-").map(Number);
  const targetYear = year + years;
  const finalDay = Math.min(day, new Date(Date.UTC(targetYear, month, 0)).getUTCDate());
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;
}
