# Memasang logo MILALA BANK

Paket ini menggunakan identitas logo dari gambar yang Anda unggah:
- `assets/img/milala-mark.png`: simbol M gradasi biru/sian, transparan.
- `assets/img/milala-logo-horizontal.png`: logo horizontal dan tagline, transparan.
- `assets/img/milala-favicon-32.png` / `milala-favicon-48.png`: ikon tab browser.
- `assets/img/milala-apple-icon.png`, `milala-icon-192.png`, `milala-icon-512.png`: ikon aplikasi.
- `assets/css/brand.css`: gaya tambahan terisolasi.
- `site.webmanifest`: identitas aplikasi.

Logo dipakai pada header publik, sidebar staf, header portal nasabah, login staf, kartu ilustrasi beranda, bagian Tentang, footer, dan ikon browser/layar utama.

## Cara pasang tanpa mengubah fitur lain

1. Backup kode yang aktif dan database Firebase.
2. Dari paket PATCH, salin `index.html`, `assets/js/app.js`, `assets/css/brand.css`, seluruh file `assets/img/milala-*.png`, dan `site.webmanifest` ke akar proyek Vercel. Jangan menghapus file lainnya.
3. Deploy **Preview** terlebih dahulu. Pastikan ikon tampil dan login serta menu yang sudah ada berfungsi.
4. Promosikan ke Production hanya setelah pemeriksaan selesai, kemudian lakukan hard refresh/browser cache clear bila favicon lama masih terlihat.
5. Untuk paket LENGKAP, Vercel root directory adalah `milala-bank` (bukan `milala.bank-main`), dan API Firebase/env yang ada wajib tetap dikonfigurasi.

Pemasangan logo hanya mengubah tampilan; tidak memodifikasi database, autentikasi, atau algoritme transaksi. Website live tidak otomatis berubah sampai deployment dilakukan.
