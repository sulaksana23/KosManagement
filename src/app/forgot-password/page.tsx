import { Building2 } from "lucide-react";
import { PasswordResetRequestForm } from "@/components/password-reset-form";

export default function ForgotPasswordPage() {
  return <main className="min-h-screen bg-[#f3f6f4] px-4 py-10">
    <div className="mx-auto max-w-[410px]">
      <div className="mb-7 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#245c49] text-white"><Building2 size={20} /></div><div><p className="m-0 text-lg font-bold">KosManager</p><p className="m-0 text-xs text-[#71817b]">Pemulihan akun</p></div></div>
      <PasswordResetRequestForm />
    </div>
  </main>;
}
