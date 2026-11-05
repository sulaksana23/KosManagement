import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Building2, CircleAlert } from "lucide-react";
import { db } from "@/db";
import { invitations, organizations } from "@/db/schema";
import { AcceptInvitationButton, SignOutInvitationButton } from "@/components/invitation-access";
import { getServerSession } from "@/server/context";

export const metadata: Metadata = { title: "Undangan workspace", robots: { index: false, follow: false } };

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const roleName = (role: string) => role === "manager" ? "Pengelola" : role === "finance" ? "Keuangan" : role === "tenant" ? "Penghuni" : "Staf";

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = params.token ?? "";
  const validToken = /^[a-f0-9]{64}$/i.test(token);
  const [invitation] = validToken ? await db.select({ email: invitations.email, role: invitations.role, organizationName: organizations.name })
    .from(invitations).innerJoin(organizations, eq(invitations.organizationId, organizations.id))
    .where(and(eq(invitations.tokenHash, await hashToken(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()))).limit(1) : [];
  const session = await getServerSession();
  const emailMatches = Boolean(invitation && session?.user.email.toLowerCase() === invitation.email.toLowerCase());

  return <main className="grid min-h-screen place-items-center bg-[#f3f6f4] px-4 py-10">
    <section className="surface w-full max-w-lg p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#245c49] text-white"><Building2 size={20} /></div><div><p className="m-0 text-lg font-bold">KosManager</p><p className="m-0 text-xs text-[#71817b]">Undangan workspace</p></div></div>
      {!invitation ? <div className="grid justify-items-start gap-3"><div className="grid size-9 place-items-center rounded-lg bg-[#f9ece9] text-[#a84f42]"><CircleAlert size={17} /></div><h1 className="m-0 text-lg font-bold">Undangan tidak berlaku</h1><p className="muted m-0 text-sm">Tautan ini tidak ditemukan, sudah digunakan, atau sudah kedaluwarsa. Minta pemilik workspace membuat undangan baru.</p><Link href="/login" className="btn btn-secondary mt-2">Ke halaman masuk</Link></div> : <div className="grid gap-4">
        <div><h1 className="m-0 text-lg font-bold">Anda diundang</h1><p className="muted mb-0 mt-2 text-sm">Gabung ke <strong>{invitation.organizationName}</strong> sebagai <strong>{roleName(invitation.role)}</strong>.</p></div>
        <div className="rounded-lg border border-[#e3eae6] bg-[#fbfcfb] p-3"><p className="muted m-0 text-[11px]">Undangan untuk</p><p className="mb-0 mt-1 text-sm font-semibold">{invitation.email}</p></div>
        {session ? emailMatches ? <AcceptInvitationButton token={token} /> : <div className="grid gap-2"><p className="notice notice-error m-0">Anda masuk sebagai {session.user.email}. Keluar terlebih dahulu, lalu buka undangan dengan akun {invitation.email}.</p><SignOutInvitationButton token={token} /></div> : <div className="grid gap-2 sm:flex"><Link href={`/register?invitation=${encodeURIComponent(token)}`} className="btn btn-primary">Buat akun dan terima</Link><Link href={`/login?invitation=${encodeURIComponent(token)}`} className="btn btn-secondary">Saya sudah punya akun</Link></div>}
        <p className="muted m-0 text-[11px]">Tautan ini hanya dapat dipakai sekali dan kedaluwarsa dalam 7 hari.</p>
      </div>}
    </section>
  </main>;
}
