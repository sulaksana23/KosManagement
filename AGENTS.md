# Aturan Proyek KosManager

## Bahasa dan cara kerja

- Gunakan Bahasa Indonesia untuk komunikasi dan UI; istilah teknis boleh berbahasa Inggris.
- Pahami struktur repo dan dokumen PRD sebelum mengubah kode.
- Baca file relevan saja; jangan memindai atau mengubah file generated, build, atau dependency tanpa alasan.
- Sebelum implementasi, sampaikan ringkasan rencana dan file/fitur yang terdampak.
- Jangan mengganti arsitektur, route, permission, atau aturan bisnis tanpa kebutuhan yang jelas.

## Stack dan kualitas kode

- Gunakan Next.js App Router, TypeScript strict, dan Tailwind CSS.
- Utamakan Server Components; komponen client hanya untuk interaksi yang memerlukannya.
- Pisahkan UI, domain/service, repository, validasi, dan authorization.
- Validasi semua input di server. Jangan percaya `organization_id`, role, nominal, atau status yang berasal dari browser.
- Jangan menaruh secret di source code; perbarui `.env.example` tanpa nilai rahasia.
- Pertahankan migration dan constraint database; jangan mengubah skema tanpa meninjau dampaknya.
- Cegah N+1, query tanpa batas, tagihan ganda, booking bertumpuk, dan webhook ganda.

## Keamanan dan data

- Batasi setiap query berdasarkan workspace dari sesi yang tervalidasi.
- Periksa role dan izin pada server untuk setiap operasi sensitif.
- Dokumen pribadi harus privat dan hanya dapat diakses dengan izin yang sesuai.
- Catat perubahan penting pada tarif, kontrak, pembayaran, izin, dan penghapusan.
- Jangan menandai pembayaran lunas dari redirect browser saja.

## UI/UX

- Tailwind CSS wajib; gunakan token dan komponen yang konsisten.
- Desain harus compact, bersih, terbaca, dan mobile-first responsive.
- Desktop: sidebar dan tabel ringkas. Mobile: navigasi drawer dan tampilan data yang tetap mudah dipakai.
- Hindari gap, padding, kartu dekoratif, teks kecil, gradient, dan animasi yang tidak perlu.
- Sediakan loading, empty, error, success, validasi, dan konfirmasi aksi penting.
- Pastikan label Bahasa Indonesia natural, akses keyboard, fokus terlihat, dan kontras memadai.

## Pelaporan

- Sebutkan file yang diubah dan alasan singkat.
- Catat migration, konfigurasi environment, dan batasan integrasi.
- Jangan mengklaim fitur berjalan jika baru berupa UI atau mock.
