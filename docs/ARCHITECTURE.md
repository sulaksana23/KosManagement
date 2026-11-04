# KosManager — Catatan arsitektur

Dokumen keputusan implementasi. PRD menetapkan batasan produk dan stack; keputusan yang bergantung pada versi library harus diverifikasi terhadap dokumentasi resmi saat implementasi.

## Prinsip

- Multi-tenant dengan batas data berdasarkan `organization_id` yang berasal dari sesi tervalidasi.
- Server Components sebagai default; mutasi dan aturan domain berada di lapisan server.
- Pisahkan validasi, authorization, service/domain, repository, dan UI.
- PostgreSQL sebagai sumber kebenaran untuk kontrak, invoice, pembayaran, okupansi, biaya, dan audit.
- Semua perubahan finansial dan kontrak penting menggunakan transaksi serta audit trail.
- File identitas dan bukti pembayaran disimpan privat; akses melalui URL signed yang berumur pendek.

## Stack yang ditetapkan

| Area | Pilihan |
|---|---|
| Web | Next.js App Router + TypeScript strict |
| Styling | Tailwind CSS |
| Database | PostgreSQL kompatibel Neon |
| ORM dan migrasi | Drizzle ORM |
| Validasi | Zod |
| Ikon | Lucide |

## Keputusan yang harus dibuat saat implementasi

### Autentikasi

Belum dipilih. Sebelum menambahkan dependency, bandingkan opsi yang mendukung versi stabil Next.js dan PostgreSQL, dokumentasi pemeliharaan, sesi aman, pemulihan kata sandi, undangan, serta integrasi role/workspace. Catat versi, alasan, dan batasan pilihan setelah verifikasi dokumentasi resmi.

### Penyimpanan file

Belum dipilih. Pilih object storage privat yang mendukung signed URL, pembatasan ukuran/jenis file, dan kontrol akses. Jangan menggunakan URL publik permanen untuk dokumen pribadi.

### Pembayaran dan notifikasi

Adapter disiapkan setelah provider dan kredensial tersedia. Webhook harus memverifikasi signature dan idempotency. Redirect browser tidak menjadi bukti pembayaran berhasil.

## Batas lapisan aplikasi

- `src/app`: route, layout, loading/error states, dan komposisi halaman.
- `src/features`: UI dan schema fitur yang terorganisasi.
- `src/server/auth`: pembacaan sesi tervalidasi.
- `src/server/permissions`: pemeriksaan role dan akses object.
- `src/server/repositories`: query database yang dibatasi workspace.
- `src/server/services`: aturan domain dan transaksi.
- `src/lib/validation`: schema input Zod.
- `src/lib/formatting`: format rupiah `id-ID` dan tanggal sesuai zona properti.
- `drizzle`: schema serta migration yang ditinjau dan disimpan di repository.

## Risiko yang harus ditangani

- Kebocoran lintas workspace melalui query yang tidak menyertakan scope organisasi.
- Overlap kontrak dan tagihan ganda akibat race condition; gunakan constraint/transaksi/idempotency yang sesuai.
- Ketidakcocokan timezone saat periode tagihan dan tanggal kontrak dihitung.
- Bukti bayar dan dokumen identitas terbuka melalui URL publik atau pemeriksaan kepemilikan yang lemah.
- Ringkasan dashboard tidak cocok dengan data transaksi jika query/definisi metrik tidak konsisten.
