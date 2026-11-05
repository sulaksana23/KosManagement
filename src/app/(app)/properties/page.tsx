import { and, count, eq, ilike, or, sql } from "drizzle-orm";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { db } from "@/db";
import { organizations, properties, rooms } from "@/db/schema";
import { PLAN_LIMITS } from "@/lib/plans";
import { FormCard, PageHeading, PageNotice, EmptyState, TextField } from "@/components/ui";
import { createProperty, updateProperty } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, escapeLike, getPageCount, getPageOffset, normalizeSearch, parsePage } from "@/lib/pagination";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string; page?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const q = normalizeSearch(params.q), page = parsePage(params.page);
  const where = q ? and(eq(properties.organizationId, ctx.organizationId), or(ilike(properties.name, `%${escapeLike(q)}%`), ilike(properties.address, `%${escapeLike(q)}%`))) : eq(properties.organizationId, ctx.organizationId);
  const [list, organizationRows, countRows, filteredCountRows] = await Promise.all([
    db.select({ id: properties.id, name: properties.name, address: properties.address, timezone: properties.timezone, rules: properties.rules, facilities: properties.facilities, roomCount: sql<string>`count(${rooms.id})` })
      .from(properties).leftJoin(rooms, and(eq(rooms.propertyId, properties.id), eq(rooms.organizationId, ctx.organizationId)))
      .where(where).groupBy(properties.id).orderBy(properties.name).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(page)),
    db.select({ plan: organizations.plan }).from(organizations).where(eq(organizations.id, ctx.organizationId)).limit(1),
    db.select({ total: count() }).from(properties).where(eq(properties.organizationId, ctx.organizationId)),
    db.select({ total: count() }).from(properties).where(where),
  ]);
  const totalCount = Number(countRows[0]?.total ?? 0);
  const filteredCount = Number(filteredCountRows[0]?.total ?? 0);
  const pageCount = getPageCount(filteredCount);
  const currentPage = Math.min(page, pageCount);
  const plan = organizationRows[0]?.plan ?? "free";
  const propertyLimit = PLAN_LIMITS[plan].properties;
  const reachedLimit = propertyLimit !== null && totalCount >= propertyLimit;
  return <div className="page-stack">
    <PageHeading title="Properti" description="Kelola lokasi kos dan informasi dasarnya." action={<span className="badge badge-gray">{totalCount} properti</span>} />
    <PageNotice notice={params.notice} error={params.error} />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3"><label className="field min-w-[220px] flex-1"><span>Cari properti</span><input className="input" name="q" defaultValue={q} placeholder="Nama atau alamat" /></label><button className="btn btn-secondary">Cari</button><a className="btn btn-quiet" href="/properties">Reset</a></form>
    <FormCard title="Tambah properti" description="Kelola lokasi kos dalam satu workspace.">
      {reachedLimit ? <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="muted m-0 text-sm">{ctx.role === "owner" ? "Paket Free sudah mencapai batas 1 properti." : "Paket Free sudah mencapai batas properti. Hubungi pemilik workspace untuk upgrade."}</p>
        {ctx.role === "owner" && <Link href="/plan" className="btn btn-secondary">Lihat Paket Pro</Link>}
      </div> : <form action={createProperty} className="form-grid">
        <TextField name="name" label="Nama properti" placeholder="Kos Melati" required />
        <TextField name="timezone" label="Zona waktu" defaultValue="Asia/Makassar" required />
        <div className="form-span"><TextField name="address" label="Alamat lengkap" placeholder="Jalan, kelurahan, kota" required /></div>
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan properti</button></div>
      </form>}
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><Building2 size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Daftar properti</h2></div>
      {list.length === 0 ? <EmptyState title={q ? "Properti tidak ditemukan" : "Belum ada properti"} description={q ? "Ubah kata kunci pencarian." : "Tambahkan properti pertama untuk mulai mengelola kamar."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>NAMA PROPERTI</th><th>ALAMAT</th><th>KAMAR</th><th>ZONA WAKTU</th><th>AKSI</th></tr></thead><tbody>{list.map((item) => <tr key={item.id}><td className="font-semibold">{item.name}</td><td className="max-w-[340px] truncate">{item.address}</td><td>{item.roomCount}</td><td>{item.timezone}</td><td><details className="min-w-[240px]"><summary className="cursor-pointer text-xs font-semibold text-[#39795a]">Ubah informasi</summary><form action={updateProperty} className="mt-2 grid gap-2 rounded-lg border border-[#e8eeeb] bg-[#fbfcfb] p-3"><input type="hidden" name="propertyId" value={item.id} /><label className="field"><span>Nama</span><input className="input" name="name" defaultValue={item.name} maxLength={100} required /></label><label className="field"><span>Alamat</span><input className="input" name="address" defaultValue={item.address} maxLength={300} required /></label><label className="field"><span>Zona waktu</span><input className="input" name="timezone" defaultValue={item.timezone} maxLength={80} required /></label><label className="field"><span>Aturan</span><textarea className="textarea min-h-16" name="rules" defaultValue={item.rules ?? ""} maxLength={2000} /></label><label className="field"><span>Fasilitas (pisahkan dengan koma)</span><input className="input" name="facilities" defaultValue={item.facilities.join(", ")} maxLength={1000} /></label><button className="btn btn-primary w-fit">Simpan perubahan</button></form></details></td></tr>)}</tbody></table></div>}
      <ListPagination pathname="/properties" params={{ q: q || undefined }} page={currentPage} pageCount={pageCount} />
    </section>
  </div>;
}
