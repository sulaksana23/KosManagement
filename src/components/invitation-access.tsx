"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { acceptInvitation } from "@/server/actions";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const result = await acceptInvitation(token);
      if (result.ok) {
        router.replace(result.role === "tenant" ? "/tenant" : "/dashboard");
        router.refresh();
      } else setMessage(result.message);
    });
  }

  return <div className="grid justify-items-start gap-2"><button className="btn btn-primary" type="button" onClick={accept} disabled={pending}><Check size={15} />{pending ? "Memproses…" : "Terima undangan"}</button>{message && <p className="notice notice-error m-0" role="alert">{message}</p>}</div>;
}

export function SignOutInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace(`/invite?token=${encodeURIComponent(token)}`);
    router.refresh();
  }

  return <button className="btn btn-secondary" type="button" onClick={signOut} disabled={pending}><LogOut size={15} />{pending ? "Keluar…" : "Keluar dari akun ini"}</button>;
}
