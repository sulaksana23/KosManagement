import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { Plus, Wrench } from "lucide-react";
import { db } from "@/db";
import { authUsers, maintenanceComments, maintenanceTickets, members, privateFiles, properties, rooms, tenants } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, StatusBadge, TextField } from "@/components/ui";
import { addMaintenanceComment, assignMaintenanceTicket, createMaintenanceTicket, updateMaintenanceStatus } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate } from "@/lib/format";
import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, escapeLike, getPageCount, getPageOffset, normalizeSearch, parsePage } from "@/lib/pagination";

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string; status?: string; page?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "staff"]);
  const params = await searchParams;
  const q = normalizeSearch(params.q), page = parsePage(params.page);
  const statuses = ["new", "in_progress", "waiting_tenant", "completed", "rejected"];
  const status = statuses.includes(params.status ?? "") ? params.status! : "";
  const conditions = [eq(maintenanceTickets.organizationId, ctx.organizationId)];
  if (ctx.role === "staff") conditions.push(eq(maintenanceTickets.assignedMemberId, ctx.memberId));
  if (status) conditions.push(eq(maintenanceTickets.status, status as typeof maintenanceTickets.$inferSelect.status));
  if (q) conditions.push(or(ilike(maintenanceTickets.category, `%${escapeLike(q)}%`), ilike(maintenanceTickets.description, `%${escapeLike(q)}%`), ilike(rooms.code, `%${escapeLike(q)}%`), ilike(properties.name, `%${escapeLike(q)}%`), ilike(tenants.fullName, `%${escapeLike(q)}%`))!);
  const where = and(...conditions);
  const [roomList, tenantList, list, memberList, countRows, openCountRows] = await Promise.all([
    db.select({ id: rooms.id, code: rooms.code, propertyName: properties.name }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(eq(rooms.organizationId, ctx.organizationId)).orderBy(properties.name, rooms.code),
    ctx.role === "staff" ? Promise.resolve([]) : db.select({ id: tenants.id, fullName: tenants.fullName }).from(tenants).where(eq(tenants.organizationId, ctx.organizationId)).orderBy(tenants.fullName),
    db.select({ ticket: maintenanceTickets, roomCode: rooms.code, propertyName: properties.name, tenantName: ctx.role === "staff" ? sql<string | null>`null` : tenants.fullName, assignedName: authUsers.name, photoFileId: privateFiles.id }).from(maintenanceTickets)
      .innerJoin(rooms, eq(maintenanceTickets.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id)).leftJoin(tenants, eq(maintenanceTickets.tenantId, tenants.id))
      .leftJoin(members, eq(maintenanceTickets.assignedMemberId, members.id)).leftJoin(authUsers, eq(members.userId, authUsers.id)).leftJoin(privateFiles, and(eq(privateFiles.ticketId, maintenanceTickets.id), eq(privateFiles.organizationId, ctx.organizationId)))
      .where(where).orderBy(desc(maintenanceTickets.createdAt)).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(page)),
    ctx.role === "staff" ? Promise.resolve([]) : db.select({ id: members.id, name: authUsers.name, role: members.role }).from(members).innerJoin(authUsers, eq(members.userId, authUsers.id))
      .where(and(eq(members.organizationId, ctx.organizationId), ne(members.role, "tenant"))).orderBy(authUsers.name),
    db.select({ total: count() }).from(maintenanceTickets).innerJoin(rooms, eq(maintenanceTickets.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id)).leftJoin(tenants, eq(maintenanceTickets.tenantId, tenants.id)).where(where),
    db.select({ total: count() }).from(maintenanceTickets).where(and(eq(maintenanceTickets.organizationId, ctx.organizationId), ne(maintenanceTickets.status, "completed"), ne(maintenanceTickets.status, "rejected"), ctx.role === "staff" ? eq(maintenanceTickets.assignedMemberId, ctx.memberId) : undefined)),
  ]);
  const pageCount = getPageCount(Number(countRows[0]?.total ?? 0));
  const currentPage = Math.min(page, pageCount);
  const ticketIds = list.map(({ ticket }) => ticket.id);
  const comments = ticketIds.length ? await db.select({ comment: maintenanceComments, authorName: authUsers.name }).from(maintenanceComments)
    .leftJoin(authUsers, eq(maintenanceComments.authorUserId, authUsers.id)).where(inArray(maintenanceComments.ticketId, ticketIds)).orderBy(maintenanceComments.createdAt) : [];
  const commentsByTicket = new Map<string, typeof comments>();
  for (const item of comments) {
    const items = commentsByTicket.get(item.comment.ticketId) ?? [];
    items.push(item);
    commentsByTicket.set(item.comment.ticketId, items);
  }
  return <div className="page-stack">
    <PageHeading title="Keluhan & perawatan" description={ctx.role === "staff" ? "Tiket yang ditugaskan kepada Anda dan riwayat tindak lanjutnya." : "Tugaskan tindak lanjut dan simpan riwayat status tiket."} action={<span className="badge badge-gray">{openCountRows[0]?.total ?? 0} terbuka</span>} />
    <PageNotice notice={params.notice} error={params.error} />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3"><label className="field min-w-[210px] flex-1"><span>Cari tiket</span><input className="input" name="q" defaultValue={q} placeholder="Keluhan, kamar, properti, penghuni" /></label><label className="field min-w-[170px]"><span>Status</span><select className="select" name="status" defaultValue={status}><option value="">Semua status</option>{statuses.map((value) => <option key={value} value={value}>{value === "new" ? "Baru" : value === "in_progress" ? "Diproses" : value === "waiting_tenant" ? "Menunggu penghuni" : value === "completed" ? "Selesai" : "Ditolak"}</option>)}</select></label><button className="btn btn-secondary">Terapkan</button><a className="btn btn-quiet" href="/maintenance">Reset</a></form>
    {ctx.role !== "staff" && <FormCard title="Catat keluhan" description="Foto disimpan privat di database dan hanya dapat dibuka oleh anggota yang berhak.">
      {roomList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan kamar terlebih dahulu.</p> : <form action={createMaintenanceTicket} className="form-grid">
        <SelectField name="roomId" label="Kamar" options={roomList.map((room) => ({ value: room.id, label: `${room.propertyName} · ${room.code}` }))} required />
        <SelectField name="tenantId" label="Penghuni (opsional)" options={tenantList.map((tenant) => ({ value: tenant.id, label: tenant.fullName }))} />
        <TextField name="category" label="Kategori" placeholder="Air, listrik, pintu" required />
        <SelectField name="priority" label="Prioritas" options={[{ value: "low", label: "Rendah" }, { value: "normal", label: "Normal" }, { value: "high", label: "Tinggi" }, { value: "urgent", label: "Mendesak" }]} defaultValue="normal" required />
        <div className="form-span field"><label htmlFor="description">Deskripsi</label><textarea className="textarea" id="description" name="description" maxLength={1000} required /></div>
        <label className="form-span field"><span>Foto kondisi (opsional, maks. 1,5 MB)</span><input className="input text-xs" type="file" name="photo" accept="image/jpeg,image/png,image/webp" /></label>
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Buat tiket</button></div>
      </form>}
    </FormCard>}
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><Wrench size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Daftar tiket</h2></div>
      {list.length === 0 ? <EmptyState title={q || status ? "Tiket tidak ditemukan" : ctx.role === "staff" ? "Belum ada tiket untuk Anda" : "Belum ada tiket"} description={q || status ? "Ubah pencarian atau filter." : ctx.role === "staff" ? "Tiket akan muncul setelah pengelola menugaskannya." : "Keluhan yang dicatat akan tersimpan dengan riwayat status."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>DIBUAT</th><th>KELUHAN</th><th>PROPERTI / KAMAR</th>{ctx.role !== "staff" && <th>PENGHUNI</th>}<th>PRIORITAS</th><th>STATUS</th><th>PENUGASAN &amp; RIWAYAT</th></tr></thead><tbody>{list.map(({ ticket, roomCode, propertyName, tenantName, assignedName, photoFileId }) => <tr key={ticket.id}><td>{formatDate(ticket.createdAt)}</td><td className="max-w-[250px] whitespace-normal"><p className="m-0 font-semibold">{ticket.category}</p><p className="muted mb-0 mt-1">{ticket.description}</p>{photoFileId && <a className="mt-1 inline-block text-xs text-[#39795a] underline" href={`/api/private-files/${photoFileId}`}>Lihat foto</a>}</td><td>{propertyName} · {roomCode}</td>{ctx.role !== "staff" && <td>{tenantName ?? "—"}</td>}<td><StatusBadge status={ticket.priority} /></td><td><div className="grid justify-items-start gap-1"><StatusBadge status={ticket.status} /><form action={updateMaintenanceStatus} className="flex min-w-[220px] items-center gap-1.5"><input type="hidden" name="ticketId" value={ticket.id} /><select className="select min-h-8 w-auto py-1 text-[11px]" name="status" defaultValue={ticket.status}><option value="new">Baru</option><option value="in_progress">Diproses</option><option value="waiting_tenant">Menunggu penghuni</option><option value="completed">Selesai</option><option value="rejected">Ditolak</option></select><button className="btn btn-quiet">Simpan</button></form></div></td><td><details className="min-w-[220px]"><summary className="cursor-pointer text-xs font-semibold text-[#39795a]">{assignedName ? `Ditugaskan: ${assignedName}` : "Atur penugasan / komentar"}</summary><div className="mt-2 grid gap-3 rounded-lg border border-[#e8eeeb] bg-[#fbfcfb] p-3">
        {ctx.role === "owner" || ctx.role === "manager" ? <form action={assignMaintenanceTicket} className="grid gap-2"><input type="hidden" name="ticketId" value={ticket.id} /><label className="field"><span className="text-[11px] font-semibold">Tugaskan ke</span><select className="select min-h-8 text-xs" name="memberId" defaultValue={ticket.assignedMemberId ?? ""}><option value="">Belum ditugaskan</option>{memberList.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label><button className="btn btn-quiet justify-self-start">Simpan tugas</button></form> : <p className="muted m-0 text-xs">Ditugaskan kepada: {assignedName ?? "Belum ditugaskan"}</p>}
        <div className="grid gap-2">{(commentsByTicket.get(ticket.id) ?? []).map(({ comment, authorName }) => <div key={comment.id} className="border-t border-[#e8eeeb] pt-2"><p className="m-0 text-xs">{comment.body}</p><p className="muted mb-0 mt-1 text-[10px]">{authorName ?? "Anggota"} · {formatDate(comment.createdAt)}</p></div>)}<form action={addMaintenanceComment} className="grid gap-2 border-t border-[#e8eeeb] pt-2"><input type="hidden" name="ticketId" value={ticket.id} /><textarea className="textarea min-h-16 text-xs" name="body" maxLength={1000} placeholder="Tulis catatan tindak lanjut…" required /><button className="btn btn-quiet justify-self-start">Tambah komentar</button></form></div>
      </div></details></td></tr>)}</tbody></table></div>}
      <ListPagination pathname="/maintenance" params={{ q: q || undefined, status: status || undefined }} page={currentPage} pageCount={pageCount} />
    </section>
  </div>;
}
