import { and, eq, or } from "drizzle-orm";
import { FileText, Plus } from "lucide-react";
import { db } from "@/db";
import { leases, properties, rooms, tenants } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, StatusBadge, TextField } from "@/components/ui";
import { createLease, endLease } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function LeasesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const [tenantList, roomList, leaseList] = await Promise.all([
    db.select({ id: tenants.id, name: tenants.fullName }).from(tenants).where(eq(tenants.organizationId, ctx.organizationId)).orderBy(tenants.fullName),
    db.select({ id: rooms.id, code: rooms.code, rent: rooms.monthlyRent, property: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(and(eq(rooms.organizationId, ctx.organizationId), or(eq(rooms.status, "available"), eq(rooms.status, "reserved")))).orderBy(properties.name, rooms.code),
    db.select({ lease: leases, tenantName: tenants.fullName, roomCode: rooms.code, propertyName: properties.name }).from(leases)
      .innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id))
      .where(eq(leases.organizationId, ctx.organizationId)).orderBy(leases.startsAt).limit(100),
  ]);
  return <div className="page-stack">
    <PageHeading title="Kontrak sewa" description="Buat dan telusuri masa sewa penghuni." action={<span className="badge badge-gray">{leaseList.length} kontrak</span>} />
    <PageNotice notice={params.notice} error={params.error} />
    <FormCard title="Buat kontrak" description="Sistem menolak tanggal yang bertumpuk pada kamar yang sama.">
      {tenantList.length === 0 || roomList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan penghuni dan kamar tersedia terlebih dahulu.</p> : <form action={createLease} className="form-grid">
        <SelectField name="tenantId" label="Penghuni" options={tenantList.map((tenant) => ({ value: tenant.id, label: tenant.name }))} required />
        <SelectField name="roomId" label="Kamar tersedia" options={roomList.map((room) => ({ value: room.id, label: `${room.property} · ${room.code} · ${formatIDR(room.rent)}/bln` }))} required />
        <TextField name="startsAt" label="Tanggal mulai" type="date" defaultValue={todayISO()} required />
        <TextField name="endsAt" label="Tanggal akhir (opsional)" type="date" />
        <TextField name="monthlyRent" label="Sewa per bulan (Rp)" type="number" min="0" step="1" required />
        <TextField name="deposit" label="Deposit (Rp)" type="number" min="0" step="1" defaultValue="0" required />
        <TextField name="dueDay" label="Tanggal jatuh tempo setiap bulan" type="number" min="1" max="31" defaultValue="1" required />
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan kontrak</button></div>
      </form>}
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><FileText size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Riwayat kontrak</h2></div>
      {leaseList.length === 0 ? <EmptyState title="Belum ada kontrak" description="Kontrak aktif akan menentukan status huni kamar." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>PENGHUNI</th><th>KAMAR</th><th>PERIODE</th><th>SEWA / BULAN</th><th>JATUH TEMPO</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{leaseList.map(({ lease, tenantName, roomCode, propertyName }) => <tr key={lease.id}><td className="font-semibold">{tenantName}</td><td>{propertyName} · {roomCode}</td><td>{formatDate(lease.startsAt)} – {lease.endsAt ? formatDate(lease.endsAt) : "Tanpa batas akhir"}</td><td>{formatIDR(lease.monthlyRent)}</td><td>Tanggal {lease.dueDay}</td><td><StatusBadge status={lease.status} /></td><td>{lease.status === "active" ? <form action={endLease}><input type="hidden" name="leaseId" value={lease.id} /><ConfirmSubmitButton className="btn btn-quiet" message="Akhiri kontrak ini? Sistem akan memperbarui status kamar." label="Akhiri kontrak" /></form> : "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
