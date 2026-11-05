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

Better Auth `1.7.17` dengan adapter Drizzle `1.7.17`; menggunakan email dan kata sandi serta tabel sesi di PostgreSQL. Route handler memakai integrasi Next.js. Pemeriksaan sesi, workspace, dan peran dilakukan kembali di halaman, server action, serta ekspor CSV. Pemilik membuat token undangan acak sekali pakai yang disimpan sebagai hash dan kedaluwarsa dalam 7 hari; tautan dibagikan secara pribadi karena email belum dikonfigurasi. Penerimaan memeriksa alamat email akun dan memastikan akun belum terikat ke workspace lain. Reset kata sandi melalui email menunggu konfigurasi provider email. Satu akun dibatasi pada satu workspace sampai pemilih workspace tersedia.

### Penyimpanan file

Belum dipilih. Upload dokumen/foto tidak aktif. Pilih object storage privat yang mendukung signed URL, pembatasan ukuran/jenis file, dan kontrol akses sebelum mengaktifkannya. Jangan menggunakan URL publik permanen untuk dokumen pribadi.

### Pembayaran dan notifikasi

Belum diaktifkan. Pembayaran manual anggota berizin mencatat verifikasi, mengunci invoice, dan memperbarui saldo dalam transaksi. Adapter gateway baru boleh dibuat setelah provider/kredensial tersedia; webhook perlu verifikasi signature dan idempotency. Redirect browser tidak menjadi bukti pembayaran berhasil.

## Struktur implementasi saat ini

- `src/app`: route, layout, state loading/error, dan komposisi halaman server.
- `src/components`: shell navigasi dan komponen UI bersama.
- `src/server/context.ts`: sesi tervalidasi dan konteks workspace/peran.
- `src/server/actions.ts`: validasi Zod, authorization, transaksi domain, dan audit untuk mutasi.
- `src/db`: koneksi PostgreSQL dan schema Drizzle.
- `src/lib`: format rupiah, tanggal, ID, dan rentang periode.
- `drizzle`: migration SQL dan snapshot schema yang dihasilkan Drizzle Kit.

Untuk MVP, sebagian query halaman dan mutasi masih dekat dengan route/server action. Saat fitur bertambah, pindahkan query berulang ke repository dan aturan domain ke service terpisah sebelum memperluas modul.

## Risiko yang harus ditangani

- Kebocoran lintas workspace melalui query yang tidak menyertakan scope organisasi.
- Overlap kontrak dan tagihan ganda akibat race condition; gunakan constraint/transaksi/idempotency yang sesuai.
- Ketidakcocokan timezone saat periode tagihan dan tanggal kontrak dihitung.
- Bukti bayar dan dokumen identitas terbuka melalui URL publik atau pemeriksaan kepemilikan yang lemah.
- Ringkasan dashboard tidak cocok dengan data transaksi jika query/definisi metrik tidak konsisten.


## Paket Free dan Pro

Paket tersimpan sebagai enum pada workspace. Batas Free untuk properti, kamar, dan anggota diperiksa dalam transaksi dengan mengunci baris workspace agar pembuatan bersamaan tidak melewati kuota. Undangan aktif memakai slot anggota. Permintaan Pro disetujui admin platform melalui daftar email pada `KOSMANAGER_ADMIN_EMAILS`; belum ada payment gateway, harga, atau checkout otomatis.
