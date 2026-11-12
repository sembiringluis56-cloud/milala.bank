# MILALA BANK — Hotfix Kredit & Setor Tunai (12 November 2026)

## Gejala
- Portal nasabah mengembalikan `Rekening tidak aktif, bukan milik akun ini, atau data berubah` padahal halaman Rekening Saya menunjukkan akun aktif.
- Workspace staf saat Setor & Tarik Tunai mengembalikan `Database MILALA BANK kosong` walaupun rekening dan transaksi lama terbaca.

## Penyebab yang berhasil direproduksi
`lib/banking.js` memakai transaksi RTDB langsung pada dua fungsi: `applyCustomerLoan` dan `commitStaffSnapshot`. Ketika serverless instance masih memakai cache Firebase dingin, callback transaksi pertama menerima `null` sebelum state server terbaca. Kode sebelumnya membatalkan transaksi dengan `return` dan menerbitkan pesan menyesatkan. Ini bukan bukti database benar-benar kosong atau rekening tidak aktif.

## Perbaikan
Memakai `withLiveRoot(...)` yang sudah ada di proyek untuk memuat nilai server melalui listener sementara **sebelum** melakukan transaksi. Listener tetap terpasang sampai transaksi selesai lalu dilepas. Pengecekan hak akses, revisi, validasi saldo, kredit, dan jurnal berpasangan tidak diubah. Error validasi di-reset untuk tiap percobaan transaction sehingga percobaan retry yang berhasil tidak ditolak karena error usang.

## Instalasi patch kecil
1. Backup proyek aktif dan backup Firebase Realtime Database terlebih dahulu.
2. Dari ZIP hotfix, salin hanya `lib/banking.js` ke **folder root proyek aktif** yang berisi `package.json`, `lib/`, dan `api/`. Jika ada file lain di folder yang namanya sama, jangan ganti kecuali tertulis di patch.
3. Opsional: salin `scripts/test-core-transactions.js` dan perbarui skrip `npm run check` dengan tes tersebut. Ini tidak diperlukan untuk runtime.
4. Pastikan domain memakai Vercel project dan konfigurasi Firebase yang sama; deploy preview dahulu.
5. Uji dengan akun simulasi: ajukan kredit memakai rekening aktif; cek satu riwayat pengajuan; setor nominal kecil; cek saldo + jurnal dua baris; ulangi, lalu tes revision conflict dengan dua tab.
6. Jangan mengirim ulang transaksi yang mungkin sudah berhasil sampai riwayat dan jurnal dipastikan; cegah duplikasi.

## Bukti tes lokal
- `node scripts/test-core-transactions.js` menggambarkan Firebase cold-cache dengan model in-memory. Kode asli gagal pada pengajuan kredit, sedangkan versi patch lulus pengajuan kredit rekening aktif, setor tunai, jurnal double-entry, proteksi stale-revision, dan pembersihan listener.
- `npm run check` lulus seluruh pengujian lokal tanpa menyentuh Firebase sungguhan.

## Batas verifikasi
Belum diuji lewat database produksi atau deployment live. Bila pesan masih muncul, cek Vercel Function logs pada action `applyCustomerLoan` dan `commitStaffSnapshot`, cocokkan `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`, root path `milala_core_banking`, profil UID dan status rekening. Jangan pernah bagikan private key service account.
