import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function ForbiddenPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f8f7] px-4">
    <section className="surface w-full max-w-md p-6 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-[#f9ece9] text-[#a84f42]"><ShieldX size={21} /></div>
      <h1 className="mt-4 text-lg font-bold">Akses tidak tersedia</h1>
      <p className="muted mb-0 mt-2 text-sm">Peran akun Anda belum memiliki izin untuk halaman ini. Hubungi pemilik workspace jika akses diperlukan.</p>
      <Link href="/" className="btn btn-secondary mt-5">Kembali</Link>
    </section>
  </main>;
}
