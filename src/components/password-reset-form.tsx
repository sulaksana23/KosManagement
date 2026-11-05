"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CircleAlert, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { getPasswordStrength, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/password";

export function PasswordResetRequestForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.requestPasswordReset({
        email: String(form.get("email") ?? ""),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) throw new Error(result.error.message ?? "RESET_REQUEST_FAILED");
      setSent(true);
    } catch {
      setError("Permintaan reset gagal. Periksa konfigurasi email aplikasi, lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return <section className="surface p-5 sm:p-7">
    <h1 className="m-0 text-[22px] font-bold tracking-tight">Lupa kata sandi?</h1>
    <p className="muted mb-5 mt-2 text-sm">Masukkan email akun. Jika terdaftar, tautan reset akan dikirim ke email tersebut.</p>
    {error && <p role="alert" className="notice notice-error mb-4 flex gap-2"><CircleAlert size={16} />{error}</p>}
    {sent ? <div className="notice mb-4 flex gap-2"><MailCheck size={17} /><span>Jika email cocok dengan akun, petunjuk reset akan segera dikirim. Periksa juga folder spam.</span></div> : <form onSubmit={submit} className="grid gap-4">
      <div className="field"><label htmlFor="reset-email">Email</label><input className="input" id="reset-email" name="email" type="email" autoComplete="email" required /></div>
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Mengirim…" : "Kirim tautan reset"}</button>
    </form>}
    <p className="mb-0 mt-5 text-center text-xs"><Link className="font-semibold text-[#245c49] hover:underline" href="/login">Kembali ke halaman masuk</Link></p>
  </section>;
}

export function PasswordResetForm({ token, invalidToken = false }: { token?: string; invalidToken?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(invalidToken ? "Tautan reset tidak valid atau sudah kedaluwarsa." : "");
  const [complete, setComplete] = useState(false);
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const value = String(form.get("password") ?? "");
    if (!token) return setError("Tautan reset tidak lengkap. Minta tautan baru.");
    if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
      return setError(`Kata sandi harus ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} karakter.`);
    }
    if (value !== form.get("confirmPassword")) return setError("Konfirmasi kata sandi belum sama.");

    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: value, token });
      if (result.error) throw new Error(result.error.message ?? "RESET_FAILED");
      setComplete(true);
    } catch {
      setError("Kata sandi tidak dapat diperbarui. Tautan mungkin sudah dipakai atau kedaluwarsa.");
    } finally {
      setPending(false);
    }
  }

  const strength = getPasswordStrength(password);
  const strengthTone = strength.tone === "danger" ? "bg-[#bd4a44]" : strength.tone === "warning" ? "bg-[#b7791f]" : strength.tone === "good" ? "bg-[#4b805e]" : strength.tone === "strong" ? "bg-[#245c49]" : "bg-[#71817b]";
  return <section className="surface p-5 sm:p-7">
    <h1 className="m-0 text-[22px] font-bold tracking-tight">Buat kata sandi baru</h1>
    <p className="muted mb-5 mt-2 text-sm">Pilih kata sandi kuat untuk akun KosManager.</p>
    {error && <p role="alert" className="notice notice-error mb-4 flex gap-2"><CircleAlert size={16} />{error}</p>}
    {complete ? <div className="notice mb-4">Kata sandi berhasil diperbarui. <Link className="font-semibold underline" href="/login">Masuk sekarang</Link>.</div> : <form onSubmit={submit} className="grid gap-4">
      <div className="field"><label htmlFor="new-password">Kata sandi baru</label><input className="input" id="new-password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} aria-describedby="reset-password-strength" onChange={(event) => setPassword(event.currentTarget.value)} required /><span className="text-[11px] text-[#71817b]">Minimal {MIN_PASSWORD_LENGTH} karakter. Kekuatan saat ini: {strength.label.toLowerCase()}.</span><div id="reset-password-strength" role="meter" aria-label="Kekuatan kata sandi" aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score} aria-valuetext={strength.label} className="mt-2 flex gap-1">{Array.from({ length: 4 }, (_, index) => <span key={index} aria-hidden="true" className={`h-1.5 flex-1 rounded-full ${index < strength.score ? strengthTone : "bg-[#e5ebe7]"}`} />)}</div></div>
      <div className="field"><label htmlFor="confirm-password">Ulangi kata sandi baru</label><input className="input" id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} required /></div>
      <button className="btn btn-primary w-full" disabled={pending || !token}>{pending ? "Menyimpan…" : "Perbarui kata sandi"}</button>
    </form>}
    {!complete && <p className="mb-0 mt-5 text-center text-xs"><Link className="font-semibold text-[#245c49] hover:underline" href="/forgot-password">Minta tautan reset baru</Link></p>}
  </section>;
}
