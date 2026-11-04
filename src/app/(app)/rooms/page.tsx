import { eq } from "drizzle-orm";
import { BedDouble, Plus } from "lucide-react";
import { db } from "@/db";
import { properties, rooms } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, StatusBadge, TextField } from "@/components/ui";
import { createRoom, updateRoomStatus } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatIDR } from "@/lib/format";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "staff"]);
  const params = await searchParams;
  const [propertyList, roomList] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).where(eq(properties.organizationId, ctx.organizationId)).orderBy(properties.name),
    db.select({ room: rooms, propertyName: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(eq(rooms.organizationId, ctx.organizationId)).orderBy(properties.name, rooms.code).limit(100),
  ]);
  const roomOptions = { available: "Tersedia", maintenance: "Perawatan", inactive: "Nonaktif" };
  return <div className="page-stack">
    <PageHeading title="Kamar" description="Atur tipe, harga, dan status kamar di semua properti." action={<span className="badge badge-gray">{roomList.length} kamar</span>} />
    <PageNotice notice={params.notice} error={params.error} />
    {ctx.role !== "staff" && <FormCard title="Tambah kamar" description="Nomor kamar harus unik di dalam properti yang dipilih.">
      {propertyList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan properti terlebih dahulu sebelum membuat kamar.</p> : <form action={createRoom} className="form-grid">
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
      {roomList.length === 0 ? <EmptyState title="Belum ada kamar" description="Kamar yang sudah ditambahkan akan tampil di sini." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>KAMAR</th><th>PROPERTI</th><th>TIPE</th>{ctx.role !== "staff" && <th>SEWA / BULAN</th>}<th>STATUS</th>{ctx.role !== "staff" && <th>UBAH STATUS</th>}</tr></thead><tbody>{roomList.map(({ room, propertyName }) => <tr key={room.id}><td className="font-semibold">{room.code}</td><td>{propertyName}</td><td>{room.type}{room.floor ? ` · Lantai ${room.floor}` : ""}</td>{ctx.role !== "staff" && <td>{formatIDR(room.monthlyRent)}</td>}<td><StatusBadge status={room.status} /></td>{ctx.role !== "staff" && <td>{["occupied", "reserved"].includes(room.status) ? <span className="text-[11px] text-[#82918b]">Diatur kontrak</span> : <form action={updateRoomStatus} className="flex items-center gap-1.5"><input type="hidden" name="roomId" value={room.id} /><select className="select min-h-8 w-auto py-1 text-[11px]" name="status" defaultValue={room.status}>{Object.entries(roomOptions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="btn btn-quiet">Simpan</button></form>}</td>}</tr>)}</tbody></table></div>}
    </section>
  </div>;
}
