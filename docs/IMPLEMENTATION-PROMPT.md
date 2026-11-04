# KosManager — Master prompt implementasi

Bertindak sebagai senior product engineer, software architect, dan UI engineer untuk membangun KosManager, sistem manajemen kos multi-properti.

## Sumber kebenaran

1. Baca `docs/PRD.md`, `docs/FLOWCHART.md`, `docs/ARCHITECTURE.md`, dan `AGENTS.md` sebelum mengubah kode.
2. Ikuti kebutuhan, aturan bisnis, role, keamanan, dan kriteria penerimaan yang tertulis. Jika ada konflik, jangan menebak: jelaskan konflik dan pilih solusi paling aman dengan alasan.
3. Jangan mengarang integrasi yang belum memiliki kredensial atau konfigurasi.

## Tujuan

Bangun aplikasi produksi yang benar-benar berfungsi untuk pemilik kos, pengelola, staf, keuangan, dan penghuni. Sistem menangani workspace multi-properti, kamar, penghuni, kontrak, tagihan, pembayaran, utilitas, biaya operasional, keluhan/perawatan, notifikasi, dan laporan.

## Stack wajib

- Next.js App Router dengan TypeScript strict.
- Tailwind CSS untuk styling seluruh UI.
- PostgreSQL kompatibel Neon, Drizzle ORM, dan migration.
- Zod untuk validasi input; Lucide untuk ikon.
- Pilih library autentikasi yang kompatibel dengan versi stabil Next.js/PostgreSQL saat pengerjaan. Verifikasi dokumentasi resminya dan tulis keputusan di `docs/ARCHITECTURE.md`.
- Gunakan versi stabil yang saling kompatibel; jangan menyalin API lama tanpa verifikasi.

## Aturan sebelum coding

- Inspeksi repo secara terarah: `package.json`, app structure, database, auth, routing, dan dokumen proyek.
- Pertahankan kode yang sudah ada. Jangan rewrite total jika repo sudah memiliki implementasi yang bisa dipakai.
- Buat rencana fase dan peta route/schema terlebih dahulu, lalu implementasikan per vertical slice.
- Jika repository kosong, bootstrap proyek dengan struktur yang disarankan PRD.
- Jangan menaruh secret sungguhan. Sediakan `.env.example` dan README setup.
- Gunakan data seed hanya untuk development/demo dan tandai jelas.

## Keamanan wajib

- Terapkan organization/workspace isolation di server untuk setiap query dan mutation.
- Derive `organization_id` dan role dari sesi tervalidasi; jangan percaya nilai dari client.
- Implementasikan authorization server-side untuk pemilik, pengelola, keuangan, staf, dan penghuni.
- Validasi input, file, batas ukuran, MIME type, dan kepemilikan object.
- Dokumen pribadi harus privat. Jangan tampilkan bukti bayar/identitas lewat URL publik permanen.
- Tagihan periodik harus idempoten; kontrak aktif tidak boleh overlap pada kamar yang sama.
- Pembayaran perlu audit trail. Webhook harus verifikasi signature dan idempotency; redirect browser tidak cukup untuk mengonfirmasi pembayaran.
- Gunakan transaksi untuk operasi yang mengubah kontrak, invoice, pembayaran, dan status kamar.

## UI wajib

- Semua UI memakai Tailwind CSS dengan komponen konsisten.
- Buat desain compact, rapi, dan mobile-first responsive. Hindari ruang kosong berlebihan, gap/padding besar, kartu dekoratif, gradient berlebihan, dan template admin generik.
- Desktop: sidebar, filter jelas, tabel padat dan mudah dipindai.
- Mobile: sidebar menjadi drawer; tabel diubah menjadi kolom prioritas/kartu ringkas atau scroll yang terkontrol; jangan membuat teks terlalu kecil.
- Form satu kolom pada layar kecil; gunakan beberapa kolom hanya jika lebar memadai.
- Pastikan target sentuh nyaman, keyboard dapat digunakan, fokus terlihat, label jelas, dan kontras cukup.
- UI berbahasa Indonesia natural. Format uang IDR dengan `id-ID` dan waktu memakai timezone properti.
- Setiap halaman memiliki loading, empty, error, success, dan konfirmasi tindakan berisiko.

## Urutan implementasi

1. Audit repo, rencana, arsitektur, env schema, dan database/migration.
2. Auth, workspace, role, permission, dan layout responsive.
3. Properti, gedung, kamar, status, pencarian, dan filter.
4. Penghuni, permohonan sewa, kontrak, dan validasi tanggal overlap.
5. Invoice, item tagihan, pembayaran manual, bukti privat, dan reminder.
6. Pencatatan meter utilitas dan biaya operasional.
7. Tiket perawatan, komentar, penugasan, dan riwayat.
8. Dashboard dan laporan berdasarkan query database nyata.
9. Portal penghuni, notifikasi, audit log, dan integrasi hanya bila konfigurasi tersedia.
10. README, migration/seed, dokumentasi, serta ringkasan keterbatasan.

## Kualitas implementasi

- Jangan membuat tombol palsu atau halaman yang hanya berisi mockup.
- Gunakan pagination dan filter server-side pada daftar besar; sediakan empty state yang berguna.
- Hindari N+1, duplikasi aturan bisnis, komponen raksasa, dan query tanpa batas.
- Simpan uang dalam tipe numerik yang aman, bukan floating point.
- Buat constraint/index yang mendukung aturan unik dan relasi.
- Implementasikan pengujian untuk aturan domain kritis dan alur akses workspace.
- Jalankan pemeriksaan yang tersedia setelah implementasi dan laporkan hasil sebenarnya; jangan mengklaim lolos jika belum dijalankan.

## Hasil akhir yang harus dilaporkan

- Fitur yang sudah benar-benar berfungsi.
- File dan migration yang dibuat/diubah.
- Cara install, konfigurasi `.env`, menjalankan migration, seed development, dan start aplikasi.
- Perintah pemeriksaan yang dijalankan beserta hasil aktual.
- Integrasi yang masih memerlukan akun/kredensial dan risiko teknis yang tersisa.
- Jangan commit, push, merge, atau deploy tanpa instruksi eksplisit pemilik repo.
