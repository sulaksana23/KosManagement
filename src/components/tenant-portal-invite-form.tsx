"use client";

import { useActionState, useState } from "react";
import { Copy, UserRoundPlus } from "lucide-react";
import { createTenantPortalInvite } from "@/server/actions";

export function TenantPortalInviteForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState(createTenantPortalInvite, {});
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.inviteLink) return;
    await navigator.clipboard.writeText(state.inviteLink);
    setCopied(true);
  }

  return <div className="grid gap-2">
    {state.inviteLink ? <div className="flex flex-wrap items-center gap-2">
      <span className="badge badge-amber">Undangan aktif</span>
      <button className="btn btn-secondary" type="button" onClick={copyLink}><Copy size={14} />{copied ? "Tersalin" : "Salin tautan"}</button>
    </div> : <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <button className="btn btn-secondary" disabled={pending}><UserRoundPlus size={14} />{pending ? "Membuat tautan…" : "Undang ke portal"}</button>
    </form>}
    {state.error && <p className="notice notice-error m-0" role="alert">{state.error}</p>}
    {state.inviteLink && <input className="input min-w-[220px] text-xs" readOnly value={state.inviteLink} aria-label="Tautan undangan portal penghuni" />}
  </div>;
}
