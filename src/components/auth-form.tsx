"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Building2, CircleAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { acceptInvitation } from "@/server/actions";

export function AuthForm({ mode, invitationToken }: { mode: "login" | "register"; invitationToken?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = isRegister
        ? await authClient.signUp.email({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")) })
        : await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) });
      if (result.error) {
        setError(result.error.message ?? "Tidak dapat memproses akun. Periksa email dan kata sandi.");
        return;
      }
      if (invitationToken) {
        const acceptance = await acceptInvitation(invitationToken);
        if (!acceptance.ok) {
          setError(acceptance.message);
          return;
        }
      }
      router.replace(invitationToken || !isRegister ? "/dashboard" : "/setup");
      router.refresh();
    } catch {
      setError("Server belum siap. Pastikan database sudah berjalan dan migrasi sudah diterapkan.");
    } finally {
      setPending(false);
    }
  }

  return <div className="min-h-screen bg-[#f3f6f4] px-4 py-10">
    <div className="mx-auto max-w-[410px]">
      <div className="mb-7 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#245c49] text-white"><Building2 size={20} /></div><div><p className="m-0 text-lg font-bold">KosManager</p><p className="m-0 text-xs text-[#71817b]">Kelola kos lebih rapi</p></div></div>
      <div className="surface p-5 sm:p-7">
        <h1 className="m-0 text-[22px] font-bold tracking-tight">{invitationToken ? isRegister ? "Buat akun anggota" : "Masuk untuk bergabung" : isRegister ? "Buat akun pemilik" : "Masuk ke KosManager"}</h1>
        <p className="muted mb-5 mt-2 text-sm">{invitationToken ? "Gunakan email yang sama dengan alamat tujuan undangan." : isRegister ? "Mulai kelola properti dan kamar dalam satu workspace." : "Masuk untuk melihat operasional properti Anda."}</p>
        {error && <div className="notice notice-error mb-4 flex gap-2"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error}</div>}
        <form onSubmit={submit} className="grid gap-4">
          {isRegister && <div className="field"><label htmlFor="name">Nama</label><input className="input" id="name" name="name" autoComplete="name" minLength={2} maxLength={80} required /></div>}
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Kata sandi</label><input className="input" id="password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={10} maxLength={128} required /><span className="text-[11px] text-[#71817b]">Minimal 10 karakter.</span></div>
          <button className="btn btn-primary mt-1 w-full" disabled={pending}>{pending ? "Memproses…" : isRegister ? "Buat akun" : "Masuk"}</button>
        </form>
        <p className="mb-0 mt-5 text-center text-xs text-[#71817b]">{isRegister ? "Sudah punya akun? " : "Belum punya akun? "}<Link className="font-semibold text-[#245c49] hover:underline" href={`${isRegister ? "/login" : "/register"}${invitationToken ? `?invitation=${encodeURIComponent(invitationToken)}` : ""}`}>{isRegister ? "Masuk" : "Daftar"}</Link></p>
      </div>
      <p className="mt-4 text-center text-[11px] text-[#82918b]">Data workspace hanya dapat diakses oleh anggota yang berizin.</p>
    </div>
  </div>;
}
