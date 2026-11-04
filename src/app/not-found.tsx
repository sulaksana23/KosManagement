import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f8f7] p-6"><div className="surface max-w-md p-7 text-center"><p className="m-0 text-sm font-bold text-[#438363]">404</p><h1 className="mt-2 text-xl font-bold">Halaman tidak ditemukan</h1><p className="muted text-sm">Periksa alamat halaman atau kembali ke dashboard.</p><Link className="btn btn-primary mt-3" href="/dashboard">Kembali ke dashboard</Link></div></main>;
}
