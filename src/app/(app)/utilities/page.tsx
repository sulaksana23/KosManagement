import { and, count, desc, eq, gte, ilike, lt, or } from "drizzle-orm";
import { Gauge, Plus } from "lucide-react";
import { db } from "@/db";
import { properties, rooms, utilityReadings } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, TextField } from "@/components/ui";
import { correctUtilityReading, createUtilityReading } from "@/server/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";
import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, escapeLike, getPageCount, getPageOffset, normalizeSearch, parsePage } from "@/lib/pagination";

export default async function UtilitiesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string; propertyId?: string; from?: string; to?: string; page?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const params = await searchParams;
  const today = todayISO(), defaultMonth = today.slice(0, 7);
  const validMonth = (value: string | undefined, fallback: string) => value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
  const q = normalizeSearch(params.q), propertyId = params.propertyId ?? "", from = validMonth(params.from, defaultMonth), toRaw = validMonth(params.to, defaultMonth), to = from <= toRaw ? toRaw : from, page = parsePage(params.page);
  const toExclusiveDate = new Date(`${to}-01T00:00:00Z`); toExclusiveDate.setUTCMonth(toExclusiveDate.getUTCMonth() + 1);
  const toExclusive = toExclusiveDate.toISOString().slice(0, 10);
  const conditions = [eq(utilityReadings.organizationId, ctx.organizationId), eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId), gte(utilityReadings.periodStart, `${from}-01`), lt(utilityReadings.periodStart, toExclusive)];
  if (propertyId) conditions.push(eq(properties.id, propertyId));
  if (q) conditions.push(or(ilike(rooms.code, `%${escapeLike(q)}%`), ilike(properties.name, `%${escapeLike(q)}%`), ilike(utilityReadings.meterType, `%${escapeLike(q)}%`))!);
  const where = and(...conditions);
  const [propertyList, roomList, list, countRows] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).where(eq(properties.organizationId, ctx.organizationId)).orderBy(properties.name),
    db.select({ id: rooms.id, code: rooms.code, propertyName: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(and(eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId))).orderBy(properties.name, rooms.code).limit(500),
    db.select({ reading: utilityReadings, roomCode: rooms.code, propertyName: properties.name }).from(utilityReadings).innerJoin(rooms, eq(utilityReadings.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(where).orderBy(desc(utilityReadings.periodStart)).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(page)),
    db.select({ total: count() }).from(utilityReadings).innerJoin(rooms, eq(utilityReadings.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(where),
  ]);
  const pageCount = getPageCount(Number(countRows[0]?.total ?? 0));
  const currentPage = Math.min(page, pageCount);
  const currentPeriod = `${todayISO().slice(0, 7)}-01`;
  return <div className="page-stack">
    <PageHeading title="Meter utilitas" description="Catat pemakaian listrik atau air per kamar dan periode." />
    <PageNotice notice={params.notice} error={params.error} />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3"><label className="field min-w-[190px] flex-1"><span>Cari meter</span><input className="input" name="q" defaultValue={q} placeholder="Kamar, properti, jenis meter" /></label><label className="field min-w-[170px]"><span>Properti</span><select className="select" name="propertyId" defaultValue={propertyId}><option value="">Semua properti</option>{propertyList.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><TextField name="from" label="Periode dari" type="month" defaultValue={from} /><TextField name="to" label="Periode sampai" type="month" defaultValue={to} /><button className="btn btn-secondary">Terapkan</button><a className="btn btn-quiet" href="/utilities">Reset</a></form>
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
      {list.length === 0 ? <EmptyState title={q || propertyId ? "Meter tidak ditemukan" : "Belum ada meter"} description={q || propertyId ? "Ubah pencarian, properti, atau periode." : "Angka meter dan perhitungannya akan muncul setelah disimpan."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>PERIODE</th><th>PROPERTI</th><th>KAMAR</th><th>JENIS</th><th>ANGKA AWAL</th><th>ANGKA AKHIR</th><th>TARIF</th><th>TAGIHAN</th><th>KOREKSI</th></tr></thead><tbody>{list.map(({ reading, roomCode, propertyName }) => <tr key={reading.id}><td>{formatDate(reading.periodStart)}</td><td>{propertyName}</td><td>{roomCode}</td><td>{reading.meterType === "electricity" ? "Listrik" : reading.meterType === "water" ? "Air" : reading.meterType}</td><td>{reading.startValue}</td><td>{reading.endValue}</td><td>{formatIDR(reading.rate)}</td><td className="font-semibold">{formatIDR(reading.amount)}</td><td>
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
      <ListPagination pathname="/utilities" params={{ q: q || undefined, propertyId: propertyId || undefined, from, to }} page={currentPage} pageCount={pageCount} />
    </section>
  </div>;
}
