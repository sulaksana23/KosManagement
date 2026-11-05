"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Building2, Check, CircleAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  getPasswordStrength,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/password";
import { acceptInvitation, getAuthenticatedLandingPath } from "@/server/actions";

const strengthToneClasses = {
  neutral: { bar: "bg-[#71817b]", text: "text-[#71817b]" },
  danger: { bar: "bg-[#bd4a44]", text: "text-[#a43d38]" },
  warning: { bar: "bg-[#b7791f]", text: "text-[#8a5a14]" },
  good: { bar: "bg-[#4b805e]", text: "text-[#3f704f]" },
  strong: { bar: "bg-[#245c49]", text: "text-[#245c49]" },
} as const;

function PasswordStrength({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const tone = strengthToneClasses[strength.tone];

  return (
    <div className="mt-2 space-y-2" id="password-strength">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-[#71817b]">Kekuatan kata sandi</span>
        <span aria-live="polite" className={`font-semibold ${tone.text}`}>
          {strength.label}
        </span>
      </div>

      <div
        role="meter"
        aria-label="Kekuatan kata sandi"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength.score}
        aria-valuetext={strength.label}
        className="flex gap-1"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`h-1.5 flex-1 rounded-full ${index < strength.score ? tone.bar : "bg-[#e5ebe7]"}`}
          />
        ))}
      </div>

      <ul aria-label="Panduan kata sandi" className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {strength.rules.map((rule) => (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 ${rule.valid ? "text-[#456c53]" : "text-[#71817b]"}`}
          >
            <span aria-hidden="true" className="grid size-3.5 shrink-0 place-items-center">
              {rule.valid ? <Check size={12} strokeWidth={2.5} /> : <span className="size-1.5 rounded-full bg-current opacity-60" />}
            </span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthForm({ mode, invitationToken }: { mode: "login" | "register"; invitationToken?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const data = new FormData(event.currentTarget);
    const passwordValue = String(data.get("password") ?? "");
    if (isRegister && passwordValue.length < MIN_PASSWORD_LENGTH) {
      setError(`Kata sandi harus terdiri dari minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }

    setPending(true);
    try {
      const result = isRegister
        ? await authClient.signUp.email({
            name: String(data.get("name")),
            email: String(data.get("email")),
            password: passwordValue,
          })
        : await authClient.signIn.email({
            email: String(data.get("email")),
            password: passwordValue,
          });

      if (result.error) {
        setError(result.error.message ?? "Tidak dapat memproses akun. Periksa email dan kata sandi.");
        return;
      }

      let acceptedRole: string | undefined;
      if (invitationToken) {
        const acceptance = await acceptInvitation(invitationToken);
        if (!acceptance.ok) {
          setError(acceptance.message);
          return;
        }
        acceptedRole = acceptance.role;
      }

      const destination = invitationToken ? (acceptedRole === "tenant" ? "/tenant" : "/dashboard") : !isRegister ? await getAuthenticatedLandingPath() : "/setup";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Server belum siap. Pastikan database sudah berjalan dan migrasi sudah diterapkan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6f4] px-4 py-10">
      <div className="mx-auto max-w-[410px]">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#245c49] text-white">
            <Building2 size={20} />
          </div>
          <div>
            <p className="m-0 text-lg font-bold">KosManager</p>
            <p className="m-0 text-xs text-[#71817b]">Kelola kos lebih rapi</p>
          </div>
        </div>

        <div className="surface p-5 sm:p-7">
          <h1 className="m-0 text-[22px] font-bold tracking-tight">
            {invitationToken
              ? isRegister
                ? "Buat akun anggota"
                : "Masuk untuk bergabung"
              : isRegister
                ? "Buat akun pemilik"
                : "Masuk ke KosManager"}
          </h1>
          <p className="muted mb-5 mt-2 text-sm">
            {invitationToken
              ? "Gunakan email yang sama dengan alamat tujuan undangan."
              : isRegister
                ? "Mulai kelola properti dan kamar dalam satu workspace."
                : "Masuk untuk melihat operasional properti Anda."}
          </p>

          {error && (
            <div className="notice notice-error mb-4 flex gap-2">
              <CircleAlert size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={submit} className="grid gap-4">
            {isRegister && (
              <div className="field">
                <label htmlFor="name">Nama</label>
                <input
                  className="input"
                  id="name"
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Kata sandi</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
                maxLength={MAX_PASSWORD_LENGTH}
                aria-describedby={isRegister ? "password-help" : undefined}
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
              />
              {isRegister ? (
                <div className="mt-1">
                  <p id="password-help" className="m-0 text-[11px] text-[#71817b]">
                    Minimal {MIN_PASSWORD_LENGTH} karakter; maksimum {MAX_PASSWORD_LENGTH}.
                  </p>
                  <PasswordStrength password={password} />
                </div>
              ) : (
                <span className="text-[11px] text-[#71817b]">
                  Masukkan kata sandi akun Anda.
                </span>
              )}
            </div>

            <button className="btn btn-primary mt-1 w-full" disabled={pending}>
              {pending ? "Memproses…" : isRegister ? "Buat akun" : "Masuk"}
            </button>
          </form>

          {!isRegister && !invitationToken && (
            <p className="mb-0 mt-3 text-right text-xs">
              <Link className="font-semibold text-[#245c49] hover:underline" href="/forgot-password">Lupa kata sandi?</Link>
            </p>
          )}

          <p className="mb-0 mt-5 text-center text-xs text-[#71817b]">
            {isRegister ? "Sudah punya akun? " : "Belum punya akun? "}
            <Link
              className="font-semibold text-[#245c49] hover:underline"
              href={`${isRegister ? "/login" : "/register"}${invitationToken ? `?invitation=${encodeURIComponent(invitationToken)}` : ""}`}
            >
              {isRegister ? "Masuk" : "Daftar"}
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-[#82918b]">
          Data workspace hanya dapat diakses oleh anggota yang berizin.
        </p>
      </div>
    </div>
  );
}
