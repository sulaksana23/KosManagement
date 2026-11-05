import { desc, eq } from "drizzle-orm";
import { Gauge, Plus } from "lucide-react";
import { db } from "@/db";
import { properties, rooms, utilityReadings } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, TextField } from "@/components/ui";
import { correctUtilityReading, createUtilityReading } from "@/server/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";

export default async function UtilitiesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const params = await searchParams;
  const [roomList, list] = await Promise.all([
    db.select({ id: rooms.id, code: rooms.code, propertyName: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(eq(rooms.organizationId, ctx.organizationId)).orderBy(properties.name, rooms.code),
    db.select({ reading: utilityReadings, roomCode: rooms.code, propertyName: properties.name }).from(utilityReadings).innerJoin(rooms, eq(utilityReadings.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(eq(utilityReadings.organizationId, ctx.organizationId)).orderBy(desc(utilityReadings.periodStart)).limit(100),
  ]);
  const currentPeriod = `${todayISO().slice(0, 7)}-01`;
  return <div className="page-stack">
    <PageHeading title="Meter utilitas" description="Catat pemakaian listrik atau air per kamar dan periode." />
    <PageNotice notice={params.notice} error={params.error} />
    <FormCard title="Catat meter" description="Angka disimpan sampai 3 desimal. Koreksi meminta alasan dan hanya tersedia sebelum tagihan periode dibuat.">
      {roomList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan kamar terlebih dahulu.</p> : <form action={createUtilityReading} className="form-grid">
        <SelectField name="roomId" label="Kamar" options={roomList.map((room) => ({ value: room.id, label: `${room.propertyName} · ${room.code}` }))} required />
        <SelectField name="meterType" label="Jenis meter" options={[{ value: "electricity", label: "Listrik" }, { value: "water", label: "Air" }]} required />
        <TextField name="periodStart" label="Periode tagihan" type="month" defaultValue={currentPeriod.slice(0, 7)} required />
        <TextField name="startValue" label="Angka awal" type="number" min="0" step="0.001" required />
        <TextField name="endValue" label="Angka akhir" type="number" min="0" step="0.001" required />
        <TextField name="rate" label="Tarif per unit (Rp)" type="number" min="0" step="1" required />
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan pencatatan</button></div>
      </form>}
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><Gauge size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Riwayat meter</h2></div>
      {list.length === 0 ? <EmptyState title="Belum ada meter" description="Angka meter dan perhitungannya akan muncul setelah disimpan." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>PERIODE</th><th>PROPERTI</th><th>KAMAR</th><th>JENIS</th><th>ANGKA AWAL</th><th>ANGKA AKHIR</th><th>TARIF</th><th>TAGIHAN</th><th>KOREKSI</th></tr></thead><tbody>{list.map(({ reading, roomCode, propertyName }) => <tr key={reading.id}><td>{formatDate(reading.periodStart)}</td><td>{propertyName}</td><td>{roomCode}</td><td>{reading.meterType === "electricity" ? "Listrik" : reading.meterType === "water" ? "Air" : reading.meterType}</td><td>{reading.startValue}</td><td>{reading.endValue}</td><td>{formatIDR(reading.rate)}</td><td className="font-semibold">{formatIDR(reading.amount)}</td><td>
          {reading.correctionReason && <p className="mb-1 max-w-56 text-xs text-[#66766f]">Alasan terakhir: {reading.correctionReason}</p>}
          <details className="min-w-[260px]">
            <summary className="cursor-pointer text-xs font-semibold text-[#438363]">Koreksi meter</summary>
            <form action={correctUtilityReading} className="mt-2 space-y-2">
              <input type="hidden" name="readingId" value={reading.id} />
              <div className="grid grid-cols-2 gap-2">
                <div className="field"><label htmlFor={"start-"+reading.id}>Angka awal</label><input className="input" id={"start-"+reading.id} name={"startValue-"+reading.id} type="number" min="0" step="0.001" defaultValue={reading.startValue} required /></div>
                <div className="field"><label htmlFor={"end-"+reading.id}>Angka akhir</label><input className="input" id={"end-"+reading.id} name={"endValue-"+reading.id} type="number" min="0" step="0.001" defaultValue={reading.endValue} required /></div>
                <div className="field col-span-2"><label htmlFor={"rate-"+reading.id}>Tarif per unit (Rp)</label><input className="input" id={"rate-"+reading.id} name={"rate-"+reading.id} type="number" min="0" step="1" defaultValue={reading.rate} required /></div>
              </div>
              <div className="field"><label htmlFor={"reason-"+reading.id}>Alasan koreksi</label><textarea className="input min-h-16" id={"reason-"+reading.id} name={"reason-"+reading.id} maxLength={500} required /></div>
              <ConfirmSubmitButton className="btn btn-primary" label="Simpan koreksi" message="Simpan koreksi meter? Nilai lama dan baru akan masuk audit log." />
            </form>
          </details>
        </td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
