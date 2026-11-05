# KosManager

Sistem web manajemen kos multi-properti: properti, kamar, penghuni, kontrak, tagihan, pembayaran, meter utilitas, biaya, keluhan, dan laporan. UI Bahasa Indonesia, compact, dan responsive.

## Pratinjau dashboard

![Mockup konsep dashboard KosManager dengan data contoh](docs/assets/kosmanager-dashboard-preview.svg)

Gambar di atas adalah mockup visual. Aplikasi berjalan menggunakan data yang tersimpan di PostgreSQL setelah mengikuti setup di bawah.

## Fitur yang tersedia

- Registrasi, login, sesi, dan workspace pemilik.
- Pengelolaan akses pemilik, pengelola, keuangan, dan staf untuk akun yang sudah mendaftar.
- Paket Free (1 properti, 10 kamar, 3 anggota) dan Pro tanpa batas dengan pemeriksaan kuota di server.
- Permintaan upgrade Pro dan persetujuan admin manual dengan audit log.
- Isolasi query berdasarkan workspace dari sesi server.
- Pencatatan properti, kamar, dan penghuni; status kamar bisa diperbarui.
- Kontrak dengan validasi server dan penguncian kamar untuk mencegah tanggal aktif bertumpuk.
- Tagihan bulanan idempoten per kontrak dan periode.
- Pencatatan dan verifikasi pembayaran manual dengan pembaruan saldo invoice dalam transaksi.
- Catatan meter utilitas, biaya operasional, dan tiket perawatan dengan riwayat audit.
- Dashboard dan laporan pemasukan, biaya, tunggakan, serta okupansi dari database.
- Ekspor CSV untuk pemasukan, biaya, dan status kamar.
- Migration PostgreSQL tersimpan di `drizzle/`.

## Menjalankan secara lokal

### Kebutuhan

- Node.js 20.9 atau lebih baru.
- Docker Compose untuk PostgreSQL lokal, atau URL koneksi PostgreSQL/Neon sendiri.
- npm dan akses ke npm registry untuk mengunduh dependency.

### Langkah

```bash
git clone https://github.com/sulaksana23/KosManagement.git
cd KosManagement
cp .env.example .env.local
```

Buat secret lokal dan masukkan ke `BETTER_AUTH_SECRET` pada `.env.local`:

```bash
openssl rand -base64 32
```

Untuk database lokal, jalankan PostgreSQL:

```bash
docker compose up -d db
```

Kemudian install dependency, terapkan migration, dan jalankan aplikasi:

```bash
npm ci
npm run db:migrate
npm run dev
```

Buka `http://localhost:3000`, pilih **Daftar**, lalu buat workspace. Untuk memakai Neon, isi `DATABASE_URL` dari dashboard Neon sebelum menjalankan migration.

Paket Free mencakup 1 properti, 10 kamar, dan 3 anggota (termasuk pemilik serta undangan aktif). Paket Pro membuka kuota tersebut tanpa batas. Untuk menerima permintaan upgrade Pro, tambahkan email admin ke `KOSMANAGER_ADMIN_EMAILS` pada environment aplikasi, lalu buka `/admin/plans`. Aktivasi saat ini ditinjau manual; pembayaran otomatis dan harga belum dikonfigurasi.

Untuk menambahkan staf: pemilik membuat tautan dari menu **Anggota** lalu membagikannya secara pribadi. Penerima dapat mendaftar atau masuk dengan email tujuan undangan; tautan hanya berlaku sekali selama 7 hari. Email tidak dikirim otomatis.

### Data demo (opsional)

Set `SEED_OWNER_EMAIL` dan `SEED_OWNER_PASSWORD` di `.env.local`, lalu jalankan:

```bash
npm run db:seed
```

Seed hanya bisa berjalan saat `NODE_ENV` bukan `production`; akun dan datanya adalah contoh development.

## Perintah proyek

```bash
npm run dev         # server development
npm run build       # build production
npm run start       # server production
npm run lint        # pemeriksaan ESLint
npm run typecheck   # pemeriksaan TypeScript
npm run db:generate # buat file migration dari perubahan schema
npm run db:migrate  # terapkan migration tersimpan
npm run db:push     # sinkronisasi schema untuk development saja
```

## Batas MVP saat ini

Email undangan tidak dikirim otomatis; pemilik membagikan tautan undangan sekali pakai melalui kanal pribadi. Satu akun hanya dapat terhubung ke satu workspace saat ini. Reset kata sandi belum dihubungkan ke layanan email. Upload bukti bayar/foto belum aktif karena object storage privat belum dikonfigurasi. Portal penghuni, tanda tangan kontrak, pengingat terjadwal, QRIS/payment gateway, dan rekonsiliasi otomatis belum tersedia. Pembayaran yang dicatat saat ini adalah pembayaran manual yang diverifikasi anggota berizin.

Jangan menaruh secret, password demo nyata, data penghuni, atau dokumen pribadi di GitHub.

## Dokumen

- [PRD](docs/PRD.md)
- [Flowchart](docs/FLOWCHART.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Prompt implementasi](docs/IMPLEMENTATION-PROMPT.md)
- [Aturan agent](AGENTS.md)
