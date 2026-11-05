# KosManager — Catatan arsitektur

Dokumen keputusan implementasi. PRD menetapkan batasan produk dan stack; keputusan yang bergantung pada versi library harus diverifikasi terhadap dokumentasi resmi saat implementasi.

## Prinsip

- Multi-tenant dengan batas data berdasarkan `organization_id` yang berasal dari sesi tervalidasi.
- Server Components sebagai default; mutasi dan aturan domain berada di lapisan server.
- Pisahkan validasi, authorization, service/domain, repository, dan UI.
- PostgreSQL sebagai sumber kebenaran untuk kontrak, invoice, pembayaran, okupansi, biaya, dan audit.
- Semua perubahan finansial dan kontrak penting menggunakan transaksi serta audit trail.
- File identitas dan bukti pembayaran disimpan privat; akses melalui URL signed yang berumur pendek.

## Stack yang diterapkan

| Area | Pilihan |
|---|---|
| Web | Next.js App Router + TypeScript strict |
| Styling | Tailwind CSS |
| Database | PostgreSQL kompatibel Neon |
| ORM dan migrasi | Drizzle ORM |
| Validasi | Zod |
| Ikon | Lucide |

Versi dasar yang dipasang saat bootstrap: Next.js `16.4.5`, React `19.3.1`, Better Auth `1.7.17`, `@better-auth/drizzle-adapter` `1.7.17`, Drizzle ORM `0.45.4`, Drizzle Kit `0.31.11`, dan Tailwind CSS `4.1`. Pembaruan versi harus ditinjau dan lockfile diperbarui bersama.

## Status keputusan implementasi

### Autentikasi

Better Auth `1.7.17` dengan adapter Drizzle `1.7.17`; menggunakan email dan kata sandi serta tabel sesi di PostgreSQL. Route handler memakai integrasi Next.js. Pemeriksaan sesi, workspace, dan peran dilakukan kembali di halaman, server action, serta ekspor CSV. Pemilik membuat token undangan sekali pakai yang disimpan sebagai hash dan kedaluwarsa dalam 7 hari. Email reset kata sandi dan undangan dikirim melalui Resend REST API jika `RESEND_API_KEY` dan `EMAIL_FROM` tersedia. Token reset berlaku 30 menit; permintaan reset tetap memberi respons generik untuk mengurangi enumerasi akun. Satu akun dibatasi pada satu workspace sampai pemilih workspace tersedia.

### Penyimpanan file

Foto bukti bayar dan foto keluhan disimpan pada tabel `private_file` dalam kolom PostgreSQL `bytea`; object storage tidak digunakan. Ukuran maksimum 1.500.000 byte, MIME JPEG/PNG/WebP harus sesuai signature file, dan SVG unggahan ditolak. Route `/api/private-files/[fileId]` selalu memeriksa sesi, workspace, role, serta relasi pemilik tiket/pembayaran sebelum mengirim file dengan cache privat/nonaktif dan `nosniff`. Server Actions memakai batas body 2 MB agar multipart untuk gambar yang valid dapat diterima. Ikon UI memakai SVG dari Lucide.

Penyimpanan bytea membuat deployment sederhana dan tidak menambah kredensial Blob, tetapi data gambar ikut menambah ukuran PostgreSQL serta backup. Pantau volume lampiran; pindah ke object storage privat hanya sebagai perubahan arsitektur tersendiri dengan kontrol akses yang sama.

### Pembayaran dan notifikasi

Pembayaran manual anggota berizin mencatat verifikasi, mengunci invoice, dan memperbarui saldo dalam transaksi. Pengingat email dijalankan melalui route `/api/cron/reminders`, dilindungi `CRON_SECRET`, dan dijadwalkan Vercel Cron setiap hari pukul 00:00 UTC. Preferensi hari pengingat per workspace dan log per invoice/tanggal disimpan di PostgreSQL; unique constraint mencegah pemrosesan ganda, kegagalan dapat dicoba lagi, dan pengiriman memakai idempotency key. Adapter gateway baru boleh dibuat setelah provider/kredensial tersedia; webhook perlu verifikasi signature dan idempotency. Redirect browser tidak menjadi bukti pembayaran berhasil.

## Migration saat deployment

Build Production Vercel menjalankan `scripts/migrate-production.mjs` sebelum `next build`. Skrip memvalidasi `BETTER_AUTH_SECRET`, lalu menerapkan migration yang belum tercatat lewat Drizzle. Ia memakai `DATABASE_URL_UNPOOLED` bila tersedia dan hanya berjalan saat `VERCEL_ENV=production`; build Preview dan lokal tidak menyentuh database secara otomatis. Untuk development, jalankan `npm run db:migrate` setelah mengisi `.env.local`.

## Struktur implementasi saat ini

- `src/app`: route, layout, state loading/error, dan komposisi halaman server.
- `src/components`: shell navigasi dan komponen UI bersama.
- `src/server/context.ts`: sesi tervalidasi dan konteks workspace/peran.
- `src/server/actions.ts`: validasi Zod, authorization, transaksi domain, dan audit untuk mutasi.
- `src/server/repositories`: query data yang membutuhkan pembatas workspace.
- `src/db`: koneksi PostgreSQL dan schema Drizzle.
- `src/lib`: format rupiah, tanggal, email, validasi file privat, pagination, dan aturan jadwal pengingat.
- `drizzle`: migration SQL dan snapshot schema yang dihasilkan Drizzle Kit.

Untuk MVP, sebagian query halaman dan mutasi masih dekat dengan route/server action. Saat fitur bertambah, pindahkan query berulang ke repository dan aturan domain ke service terpisah sebelum memperluas modul.

## Risiko yang harus ditangani

- Kebocoran lintas workspace melalui query yang tidak menyertakan scope organisasi.
- Overlap kontrak dan tagihan ganda akibat race condition; gunakan constraint/transaksi/idempotency yang sesuai.
- Ketidakcocokan timezone saat periode tagihan dan tanggal kontrak dihitung.
- Lampiran gambar disimpan di PostgreSQL; volume lampiran perlu dipantau karena memperbesar database dan backup.
- Ringkasan dashboard tidak cocok dengan data transaksi jika query/definisi metrik tidak konsisten.
- Email dan Vercel Cron memerlukan environment variable serta domain Resend yang dikonfigurasi oleh pemilik deployment.


## Paket Free dan Pro

Paket tersimpan sebagai enum pada workspace. Batas Free untuk properti, kamar, dan anggota diperiksa dalam transaksi dengan mengunci baris workspace agar pembuatan bersamaan tidak melewati kuota. Undangan aktif memakai slot anggota. Permintaan Pro disetujui admin platform melalui daftar email pada `KOSMANAGER_ADMIN_EMAILS`; belum ada payment gateway, harga, atau checkout otomatis.
