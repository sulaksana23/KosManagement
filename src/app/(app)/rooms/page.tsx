import { and, count, eq, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { BedDouble, Plus } from "lucide-react";
import { db } from "@/db";
import { organizations, properties, rooms } from "@/db/schema";
import { PLAN_LIMITS } from "@/lib/plans";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, StatusBadge, TextField } from "@/components/ui";
import { createRoom, updateRoom, updateRoomStatus } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatIDR } from "@/lib/format";
import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, escapeLike, getPageCount, getPageOffset, normalizeSearch, parsePage } from "@/lib/pagination";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string; propertyId?: string; status?: string; page?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "staff"]);
  const params = await searchParams;
  const q = normalizeSearch(params.q), propertyId = params.propertyId ?? "";
  const validStatuses = ["available", "reserved", "occupied", "maintenance", "inactive"];
  const status = validStatuses.includes(params.status ?? "") ? params.status! : "";
  const page = parsePage(params.page);
  const conditions = [eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId)];
  if (propertyId) conditions.push(eq(rooms.propertyId, propertyId));
  if (status) conditions.push(eq(rooms.status, status as typeof rooms.$inferSelect.status));
  if (q) conditions.push(or(ilike(rooms.code, `%${escapeLike(q)}%`), ilike(rooms.type, `%${escapeLike(q)}%`), ilike(properties.name, `%${escapeLike(q)}%`))!);
  const where = and(...conditions);
  const [propertyList, roomList, filteredCountRows, roomCountRows, organizationRows] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).where(eq(properties.organizationId, ctx.organizationId)).orderBy(properties.name),
    db.select({ room: rooms, propertyName: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(where).orderBy(properties.name, rooms.code).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(page)),
    db.select({ total: count() }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(where),
    db.select({ total: count() }).from(rooms).where(eq(rooms.organizationId, ctx.organizationId)),
    db.select({ plan: organizations.plan }).from(organizations).where(eq(organizations.id, ctx.organizationId)).limit(1),
  ]);
  const roomCount = Number(roomCountRows[0]?.total ?? 0);
  const filteredCount = Number(filteredCountRows[0]?.total ?? 0);
  const pageCount = getPageCount(filteredCount);
  const currentPage = Math.min(page, pageCount);
  const plan = organizationRows[0]?.plan ?? "free";
  const roomLimit = PLAN_LIMITS[plan].rooms;
  const reachedLimit = roomLimit !== null && roomCount >= roomLimit;
  const roomOptions = { available: "Tersedia", maintenance: "Perawatan", inactive: "Nonaktif" };
  return <div className="page-stack">
    <PageHeading title="Kamar" description="Atur tipe, harga, dan status kamar di semua properti." action={<span className="badge badge-gray">{roomCount} kamar</span>} />
    <PageNotice notice={params.notice} error={params.error} />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3">
      <label className="field min-w-[200px] flex-1"><span>Cari kamar atau properti</span><input className="input" name="q" defaultValue={q} placeholder="Kode, tipe, nama properti" /></label>
      <label className="field min-w-[170px]"><span>Properti</span><select className="select" name="propertyId" defaultValue={propertyId}><option value="">Semua properti</option>{propertyList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field min-w-[150px]"><span>Status</span><select className="select" name="status" defaultValue={status}><option value="">Semua status</option>{Object.entries(roomOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="reserved">Dipesan</option><option value="occupied">Dihuni</option></select></label>
      <button className="btn btn-secondary">Terapkan</button><a className="btn btn-quiet" href="/rooms">Reset</a>
    </form>
    {ctx.role !== "staff" && <FormCard title="Tambah kamar" description="Kode kamar harus unik di dalam properti yang dipilih.">
      {reachedLimit ? <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="muted m-0 text-sm">{ctx.role === "owner" ? "Paket Free sudah mencapai batas 10 kamar." : "Paket Free sudah mencapai batas kamar. Hubungi pemilik workspace untuk upgrade."}</p>
        {ctx.role === "owner" && <Link href="/plan" className="btn btn-secondary">Lihat Paket Pro</Link>}
      </div> : propertyList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan properti terlebih dahulu sebelum membuat kamar.</p> : <form action={createRoom} className="form-grid">
        <SelectField name="propertyId" label="Properti" options={propertyList.map((property) => ({ value: property.id, label: property.name }))} required />
        <TextField name="code" label="Kode kamar" placeholder="A-01" required />
        <TextField name="type" label="Tipe kamar" defaultValue="Standard" required />
        <TextField name="floor" label="Lantai" placeholder="1" />
        <TextField name="monthlyRent" label="Harga sewa per bulan (Rp)" type="number" min="0" step="1" required />
        <TextField name="deposit" label="Deposit (Rp)" type="number" min="0" step="1" defaultValue="0" required />
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan kamar</button></div>
      </form>}
    </FormCard>}
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><BedDouble size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Daftar kamar</h2></div>
      {roomList.length === 0 ? <EmptyState title={filteredCount ? "Tidak ada hasil" : "Belum ada kamar"} description={filteredCount ? "Ubah pencarian atau filter untuk melihat kamar lain." : "Kamar yang sudah ditambahkan akan tampil di sini."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>KAMAR</th><th>PROPERTI</th><th>TIPE</th>{ctx.role !== "staff" && <th>SEWA / BULAN</th>}<th>STATUS</th>{ctx.role !== "staff" && <th>UBAH STATUS</th>}{ctx.role !== "staff" && <th>DETAIL</th>}</tr></thead><tbody>{roomList.map(({ room, propertyName }) => <tr key={room.id}><td className="font-semibold">{room.code}</td><td>{propertyName}</td><td>{room.type}{room.floor ? ` · Lantai ${room.floor}` : ""}</td>{ctx.role !== "staff" && <td>{formatIDR(room.monthlyRent)}</td>}<td><StatusBadge status={room.status} /></td>{ctx.role !== "staff" && <td>{["occupied", "reserved"].includes(room.status) ? <span className="text-[11px] text-[#82918b]">Diatur kontrak</span> : <form action={updateRoomStatus} className="flex items-center gap-1.5"><input type="hidden" name="roomId" value={room.id} /><select className="select min-h-8 w-auto py-1 text-[11px]" name="status" defaultValue={room.status}>{Object.entries(roomOptions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="btn btn-quiet">Simpan</button></form>}</td>}{ctx.role !== "staff" && <td><details className="min-w-[240px]"><summary className="cursor-pointer text-xs font-semibold text-[#39795a]">Ubah kamar</summary><form action={updateRoom} className="mt-2 grid gap-2 rounded-lg border border-[#e8eeeb] bg-[#fbfcfb] p-3"><input type="hidden" name="roomId" value={room.id} /><label className="field"><span>Kode kamar</span><input className="input" name="code" defaultValue={room.code} maxLength={30} required /></label><label className="field"><span>Tipe</span><input className="input" name="type" defaultValue={room.type} maxLength={50} required /></label><label className="field"><span>Lantai</span><input className="input" name="floor" defaultValue={room.floor ?? ""} maxLength={40} /></label><label className="field"><span>Sewa per bulan (Rp)</span><input className="input" name="monthlyRent" type="number" min="1" step="1" defaultValue={room.monthlyRent} required /></label><label className="field"><span>Deposit (Rp)</span><input className="input" name="deposit" type="number" min="0" step="1" defaultValue={room.deposit} required /></label><label className="field"><span>Fasilitas (pisahkan dengan koma)</span><input className="input" name="facilities" defaultValue={room.facilities.join(", ")} maxLength={1000} /></label><label className="field"><span>Catatan</span><textarea className="textarea min-h-16" name="notes" defaultValue={room.notes ?? ""} maxLength={1000} /></label><button className="btn btn-primary w-fit">Simpan perubahan</button></form></details></td>}</tr>)}</tbody></table></div>}
      <ListPagination pathname="/rooms" params={{ q: q || undefined, propertyId: propertyId || undefined, status: status || undefined }} page={currentPage} pageCount={pageCount} />
    </section>
  </div>;
}
