import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { db } from "@/db";
import { organizations, properties, rooms } from "@/db/schema";
import { PLAN_LIMITS } from "@/lib/plans";
import { FormCard, PageHeading, PageNotice, EmptyState, TextField } from "@/components/ui";
import { createProperty } from "@/server/actions";
import { requireWorkspace } from "@/server/context";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const [list, organizationRows] = await Promise.all([
    db.select({ id: properties.id, name: properties.name, address: properties.address, timezone: properties.timezone, roomCount: sql<string>`count(${rooms.id})` })
      .from(properties).leftJoin(rooms, eq(rooms.propertyId, properties.id))
      .where(eq(properties.organizationId, ctx.organizationId)).groupBy(properties.id).orderBy(properties.name),
    db.select({ plan: organizations.plan }).from(organizations).where(eq(organizations.id, ctx.organizationId)).limit(1),
  ]);
  const plan = organizationRows[0]?.plan ?? "free";
  const propertyLimit = PLAN_LIMITS[plan].properties;
  const reachedLimit = propertyLimit !== null && list.length >= propertyLimit;
  return <div className="page-stack">
    <PageHeading title="Properti" description="Kelola lokasi kos dan informasi dasarnya." action={<span className="badge badge-gray">{list.length} properti</span>} />
    <PageNotice notice={params.notice} error={params.error} />
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
      {list.length === 0 ? <EmptyState title="Belum ada properti" description="Tambahkan properti pertama untuk mulai mengelola kamar." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>NAMA PROPERTI</th><th>ALAMAT</th><th>KAMAR</th><th>ZONA WAKTU</th></tr></thead><tbody>{list.map((item) => <tr key={item.id}><td className="font-semibold">{item.name}</td><td className="max-w-[340px] truncate">{item.address}</td><td>{item.roomCount}</td><td>{item.timezone}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
