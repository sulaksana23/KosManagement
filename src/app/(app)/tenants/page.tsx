import { and, count, eq, ilike, or } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, TextField } from "@/components/ui";
import { createTenant, updateTenant } from "@/server/actions";
import { TenantPortalInviteForm } from "@/components/tenant-portal-invite-form";
import { requireWorkspace } from "@/server/context";
import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, escapeLike, getPageCount, getPageOffset, normalizeSearch, parsePage } from "@/lib/pagination";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string; page?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const q = normalizeSearch(params.q), page = parsePage(params.page);
  const where = q ? and(eq(tenants.organizationId, ctx.organizationId), or(ilike(tenants.fullName, `%${escapeLike(q)}%`), ilike(tenants.phone, `%${escapeLike(q)}%`), ilike(tenants.email, `%${escapeLike(q)}%`))) : eq(tenants.organizationId, ctx.organizationId);
  const [list, countRows] = await Promise.all([
    db.select().from(tenants).where(where).orderBy(tenants.fullName).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(page)),
    db.select({ total: count() }).from(tenants).where(where),
  ]);
  const pageCount = getPageCount(Number(countRows[0]?.total ?? 0));
  const currentPage = Math.min(page, pageCount);
  return <div className="page-stack">
    <PageHeading title="Penghuni" description="Simpan data kontak penghuni dan kontak darurat." action={<span className="badge badge-gray">{list.length} penghuni</span>} />
    <PageNotice notice={params.notice} error={params.error} />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3"><label className="field min-w-[220px] flex-1"><span>Cari penghuni</span><input className="input" name="q" defaultValue={q} placeholder="Nama, telepon, atau email" /></label><button className="btn btn-secondary">Cari</button><a className="btn btn-quiet" href="/tenants">Reset</a></form>
    <FormCard title="Tambah penghuni" description="Data identitas yang tidak diperlukan tidak diminta oleh sistem.">
      <form action={createTenant} className="form-grid">
        <TextField name="fullName" label="Nama lengkap" required />
        <TextField name="phone" label="Nomor telepon" type="tel" required />
        <TextField name="email" label="Email" type="email" />
        <TextField name="emergencyContactName" label="Nama kontak darurat" />
        <TextField name="emergencyContactPhone" label="Telepon kontak darurat" type="tel" />
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan penghuni</button></div>
      </form>
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><Users size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Daftar penghuni</h2></div>
      {list.length === 0 ? <EmptyState title={q ? "Penghuni tidak ditemukan" : "Belum ada penghuni"} description={q ? "Coba kata kunci lain." : "Tambahkan penghuni sebelum membuat kontrak sewa."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>NAMA</th><th>TELEPON</th><th>EMAIL</th><th>KONTAK DARURAT</th><th>PORTAL</th><th>DITAMBAHKAN</th><th>AKSI</th></tr></thead><tbody>{list.map((tenant) => <tr key={tenant.id}><td className="font-semibold">{tenant.fullName}</td><td>{tenant.phone}</td><td>{tenant.email ?? "—"}</td><td>{tenant.emergencyContactName ? `${tenant.emergencyContactName} · ${tenant.emergencyContactPhone ?? "—"}` : "—"}</td><td>{tenant.userId ? <span className="badge badge-green">Aktif</span> : tenant.email ? <TenantPortalInviteForm tenantId={tenant.id} /> : <span className="muted text-xs">Email belum diisi</span>}</td><td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(tenant.createdAt)}</td><td><details className="min-w-[240px]"><summary className="cursor-pointer text-xs font-semibold text-[#39795a]">Ubah data</summary><form action={updateTenant} className="mt-2 grid gap-2 rounded-lg border border-[#e8eeeb] bg-[#fbfcfb] p-3"><input type="hidden" name="tenantId" value={tenant.id} /><label className="field"><span>Nama lengkap</span><input className="input" name="fullName" defaultValue={tenant.fullName} maxLength={120} required /></label><label className="field"><span>Telepon</span><input className="input" name="phone" defaultValue={tenant.phone} maxLength={30} required /></label><label className="field"><span>Email</span><input className="input" name="email" type="email" defaultValue={tenant.email ?? ""} maxLength={254} readOnly={Boolean(tenant.userId)} /></label><label className="field"><span>Kontak darurat</span><input className="input" name="emergencyContactName" defaultValue={tenant.emergencyContactName ?? ""} maxLength={120} /></label><label className="field"><span>Telepon darurat</span><input className="input" name="emergencyContactPhone" defaultValue={tenant.emergencyContactPhone ?? ""} maxLength={30} /></label><label className="field"><span>Catatan internal</span><textarea className="textarea min-h-16" name="notes" defaultValue={tenant.notes ?? ""} maxLength={1000} /></label><button className="btn btn-primary w-fit">Simpan perubahan</button></form></details></td></tr>)}</tbody></table></div>}
      <ListPagination pathname="/tenants" params={{ q: q || undefined }} page={currentPage} pageCount={pageCount} />
    </section>
  </div>;
}
