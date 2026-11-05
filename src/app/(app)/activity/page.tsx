import { and, count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { auditLogs, authUsers, organizations } from "@/db/schema";
import { EmptyState, PageHeading } from "@/components/ui";
import { requireWorkspace } from "@/server/context";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  "invitation.created": "Undangan dibuat",
  "invitation.revoked": "Undangan dibatalkan",
  "member.role_changed": "Peran anggota diubah",
  "member.removed": "Anggota dikeluarkan",
  "property.created": "Properti dibuat",
  "room.created": "Kamar dibuat",
  "room.status_changed": "Status kamar diubah",
  "tenant.created": "Data penghuni dibuat",
  "lease.created": "Kontrak dibuat",
  "lease.renewed": "Kontrak diperpanjang",
  "lease.renewal_cancelled": "Perpanjangan kontrak dibatalkan",
  "invoices.generated": "Tagihan bulanan dibuat",
  "payment.verified": "Pembayaran dicatat dan diverifikasi",
  "expense.created": "Biaya dicatat",
  "utility_reading.created": "Meter dicatat",
  "utility_reading.corrected": "Meter dikoreksi",
  "maintenance.created": "Tiket perawatan dibuat",
  "maintenance.status_changed": "Status tiket diubah",
  "maintenance.comment_added": "Komentar tiket ditambahkan",
  "maintenance.assigned": "Tiket ditugaskan",
  "plan.upgrade_requested": "Permintaan upgrade dikirim",
  "tenant.portal_invited": "Akses portal penghuni diundang",
  "maintenance.created_by_tenant": "Penghuni membuat tiket",
  "payment.declared_by_tenant": "Penghuni mengirim konfirmasi pembayaran",
  "payment.tenant_declaration_verified": "Konfirmasi pembayaran diverifikasi",
  "payment.tenant_declaration_rejected": "Konfirmasi pembayaran ditolak",
};

const ENTITY_LABELS: Record<string, string> = {
  organization: "Workspace",
  invitation: "Undangan",
  member: "Anggota",
  property: "Properti",
  room: "Kamar",
  tenant: "Penghuni",
  lease: "Kontrak",
  invoice: "Tagihan",
  payment: "Pembayaran",
  expense: "Biaya",
  utility_reading: "Meter utilitas",
  maintenance_ticket: "Tiket perawatan",
  plan_request: "Permintaan paket",
};

function formatDateTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");
  const safeRequestedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [countRow] = await db.select({ total: count() }).from(auditLogs)
    .where(eq(auditLogs.organizationId, ctx.organizationId));
  const total = countRow?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(safeRequestedPage, pageCount);

  const rows = await db.select({
    log: auditLogs,
    actorName: authUsers.name,
    timeZone: organizations.timezone,
  }).from(auditLogs)
    .leftJoin(authUsers, eq(auditLogs.actorUserId, authUsers.id))
    .innerJoin(organizations, eq(auditLogs.organizationId, organizations.id))
    .where(and(
      eq(auditLogs.organizationId, ctx.organizationId),
      eq(organizations.id, ctx.organizationId),
    ))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, total);

  return <div className="page-stack">
    <PageHeading title="Riwayat aktivitas" description="Perubahan penting di workspace, diurutkan dari yang terbaru." />
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eeeb] px-4 py-3">
        <div className="flex items-center gap-2"><Activity size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Aktivitas workspace</h2></div>
        <span className="muted text-xs">{total.toLocaleString("id-ID")} catatan</span>
      </div>
      {rows.length === 0 ? <EmptyState title="Belum ada aktivitas" description="Perubahan penting akan muncul di sini setelah ada aktivitas di workspace." /> : <>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>WAKTU</th><th>PELAKU</th><th>AKTIVITAS</th><th>OBJEK</th><th>REFERENSI</th></tr></thead>
            <tbody>{rows.map(({ log, actorName, timeZone }) => <tr key={log.id}>
              <td className="whitespace-nowrap">{formatDateTime(log.createdAt, timeZone)}</td>
              <td>{actorName ?? "Akun dihapus"}</td>
              <td className="font-semibold">{ACTION_LABELS[log.action] ?? "Aktivitas tercatat"}</td>
              <td>{ENTITY_LABELS[log.entityType] ?? "Data workspace"}</td>
              <td className="font-mono text-xs text-[#66766f]">{log.entityId}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8eeeb] px-4 py-3">
          <p className="muted m-0 text-xs">Menampilkan {firstItem}–{lastItem} dari {total.toLocaleString("id-ID")} aktivitas</p>
          <nav aria-label="Halaman riwayat aktivitas" className="flex items-center gap-2">
            {page > 1 ? <Link className="btn btn-secondary" href={page === 2 ? "/activity" : "/activity?page=" + (page - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={15} />Sebelumnya</Link> : <span className="btn btn-secondary opacity-50" aria-disabled="true"><ChevronLeft size={15} />Sebelumnya</span>}
            <span className="muted text-xs">Halaman {page} dari {pageCount}</span>
            {page < pageCount ? <Link className="btn btn-secondary" href={"/activity?page=" + (page + 1)} aria-label="Halaman berikutnya">Berikutnya<ChevronRight size={15} /></Link> : <span className="btn btn-secondary opacity-50" aria-disabled="true"><span>Berikutnya</span><ChevronRight size={15} /></span>}
          </nav>
        </div>
      </>}
    </section>
  </div>;
}
