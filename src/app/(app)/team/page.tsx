import { and, eq, gt, isNull } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { authUsers, invitations, members } from "@/db/schema";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InvitationForm } from "@/components/invitation-form";
import { EmptyState, FormCard, PageHeading, PageNotice } from "@/components/ui";
import { removeMember, revokeInvitation, updateMemberRole } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate } from "@/lib/format";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner"]);
  const params = await searchParams;
  const team = await db.select({ member: members, name: authUsers.name, email: authUsers.email })
    .from(members).innerJoin(authUsers, eq(members.userId, authUsers.id))
    .where(eq(members.organizationId, ctx.organizationId)).orderBy(members.createdAt);
  const pendingInvitations = await db.select().from(invitations).where(and(
    eq(invitations.organizationId, ctx.organizationId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()),
  )).orderBy(invitations.createdAt);

  return <div className="page-stack">
    <PageHeading title="Anggota workspace" description="Kelola akses dan bagikan undangan ke anggota baru." action={<span className="badge badge-gray">{team.length} anggota</span>} />
    <PageNotice notice={params.notice} error={params.error} />
    <FormCard title="Undang anggota" description="Tautan berlaku 7 hari dan dapat diterima hanya oleh akun dengan email undangan.">
      <InvitationForm />
      <p className="muted mb-0 mt-3 text-xs">Kirim tautan secara pribadi. Email belum dikirim otomatis; satu akun hanya dapat bergabung ke satu workspace.</p>
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><Users size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Daftar anggota</h2></div>
      {team.length === 0 ? <EmptyState title="Belum ada anggota" description="Pemilik workspace akan tampil setelah akun anggota pertama ditambahkan." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>NAMA</th><th>EMAIL</th><th>PERAN</th><th>AKSI</th></tr></thead><tbody>{team.map(({ member, name, email }) => <tr key={member.id}><td className="font-semibold">{name}</td><td>{email}</td><td>{member.role === "owner" ? <span className="badge badge-green">Pemilik</span> : <form action={updateMemberRole} className="flex min-w-[220px] items-center gap-2"><input type="hidden" name="memberId" value={member.id} /><select className="select min-h-8 w-auto py-1 text-xs" name="role" defaultValue={member.role}><option value="manager">Pengelola</option><option value="finance">Keuangan</option><option value="staff">Staf</option></select><button className="btn btn-quiet">Simpan</button></form>}</td><td>{member.role === "owner" || member.userId === ctx.userId ? "—" : <form action={removeMember}><input type="hidden" name="memberId" value={member.id} /><ConfirmSubmitButton className="btn btn-quiet" message={`Cabut akses ${name} dari workspace?`} label="Cabut akses" /></form>}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="surface overflow-hidden">
      <div className="border-b border-[#e8eeeb] px-4 py-3"><h2 className="surface-title m-0">Undangan aktif</h2></div>
      {pendingInvitations.length === 0 ? <EmptyState title="Tidak ada undangan aktif" description="Undangan yang dibuat akan tampil sampai diterima, dibatalkan, atau kedaluwarsa." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>EMAIL</th><th>PERAN</th><th>KEDALUWARSA</th><th>AKSI</th></tr></thead><tbody>{pendingInvitations.map((invitation) => <tr key={invitation.id}><td className="font-semibold">{invitation.email}</td><td>{invitation.role === "manager" ? "Pengelola" : invitation.role === "finance" ? "Keuangan" : "Staf"}</td><td>{formatDate(invitation.expiresAt)}</td><td><form action={revokeInvitation}><input type="hidden" name="invitationId" value={invitation.id} /><ConfirmSubmitButton className="btn btn-quiet" message={`Batalkan undangan untuk ${invitation.email}?`} label="Batalkan" /></form></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
