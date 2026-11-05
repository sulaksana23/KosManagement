"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type Props = { message: string; recipient: string };

export function CopyReminderButton({ message, recipient }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copyReminder() {
    try {
      await navigator.clipboard.writeText(message);
      setState("copied");
    } catch {
      setState("error");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }

  return <div className="inline-flex flex-col items-start gap-1">
    <button
      className="btn btn-quiet min-h-8 whitespace-nowrap px-2.5 text-[11px]"
      type="button"
      aria-label={`Salin pengingat pembayaran untuk ${recipient}`}
      onClick={copyReminder}
    >
      {state === "copied" ? <Check size={13} /> : <Copy size={13} />}
      {state === "copied" ? "Tersalin" : state === "error" ? "Gagal menyalin" : "Salin pengingat"}
    </button>
    {state === "error" && <span className="text-[10px] text-[#a33f36]" role="status">Izinkan akses papan klip, lalu coba lagi.</span>}
  </div>;
}
