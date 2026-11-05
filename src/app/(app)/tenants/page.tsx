import { eq } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, TextField } from "@/components/ui";
import { createTenant } from "@/server/actions";
import { TenantPortalInviteForm } from "@/components/tenant-portal-invite-form";
import { requireWorkspace } from "@/server/context";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const list = await db.select().from(tenants).where(eq(tenants.organizationId, ctx.organizationId)).orderBy(tenants.fullName).limit(100);
  return <div className="page-stack">
    <PageHeading title="Penghuni" description="Simpan data kontak penghuni dan kontak darurat." action={<span className="badge badge-gray">{list.length} penghuni</span>} />
    <PageNotice notice={params.notice} error={params.error} />
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
      {list.length === 0 ? <EmptyState title="Belum ada penghuni" description="Tambahkan penghuni sebelum membuat kontrak sewa." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>NAMA</th><th>TELEPON</th><th>EMAIL</th><th>KONTAK DARURAT</th><th>PORTAL</th><th>DITAMBAHKAN</th></tr></thead><tbody>{list.map((tenant) => <tr key={tenant.id}><td className="font-semibold">{tenant.fullName}</td><td>{tenant.phone}</td><td>{tenant.email ?? "—"}</td><td>{tenant.emergencyContactName ? `${tenant.emergencyContactName} · ${tenant.emergencyContactPhone ?? "—"}` : "—"}</td><td>{tenant.userId ? <span className="badge badge-green">Aktif</span> : tenant.email ? <TenantPortalInviteForm tenantId={tenant.id} /> : <span className="muted text-xs">Email belum diisi</span>}</td><td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(tenant.createdAt)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
