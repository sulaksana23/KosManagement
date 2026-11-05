"use client";

import { useActionState, useState } from "react";
import { Copy, UserRoundPlus } from "lucide-react";
import { createInvitation } from "@/server/actions";

export function InvitationForm() {
  const initialState: { error?: string; inviteLink?: string; emailSent?: boolean } = {};
  const [state, formAction, pending] = useActionState(createInvitation, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.inviteLink) return;
    await navigator.clipboard.writeText(state.inviteLink);
    setCopied(true);
  }

  return <div className="grid gap-3">
    <form action={formAction} className="form-grid">
      <div className="field"><label htmlFor="invite-email">Email anggota</label><input className="input" id="invite-email" name="email" type="email" placeholder="staf@contoh.id" autoComplete="email" required /></div>
      <label className="field"><span>Peran</span><select className="select" name="role" defaultValue="staff" required><option value="manager">Pengelola</option><option value="finance">Keuangan</option><option value="staff">Staf</option></select></label>
      <div className="form-span"><button className="btn btn-primary" disabled={pending}><UserRoundPlus size={15} />{pending ? "Membuat tautan…" : "Buat undangan"}</button></div>
    </form>
    {state.error && <p className="notice notice-error m-0" role="alert">{state.error}</p>}
    {state.inviteLink && <div className="grid gap-2 rounded-lg border border-[#cce5d4] bg-[#f0f8f2] p-3">
      <p className="m-0 text-xs font-semibold text-[#286143]">Undangan aktif selama 7 hari. {state.emailSent ? "Email undangan sudah dikirim." : "Email belum terkirim; salin dan bagikan tautan ini secara pribadi."}</p>
      <div className="flex min-w-0 items-center gap-2"><input className="input min-w-0 text-xs" readOnly value={state.inviteLink} aria-label="Tautan undangan" /><button className="btn btn-secondary shrink-0" type="button" onClick={copyLink}><Copy size={14} />{copied ? "Tersalin" : "Salin"}</button></div>
    </div>}
  </div>;
}
