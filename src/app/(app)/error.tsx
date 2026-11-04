"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="surface mx-auto mt-12 max-w-lg p-6 text-center"><h1 className="m-0 text-lg font-bold">Halaman belum dapat dimuat</h1><p className="muted my-2 text-sm">Periksa koneksi database, lalu coba lagi.</p><button className="btn btn-primary mt-3" onClick={() => reset()}>Coba lagi</button></div>;
}
