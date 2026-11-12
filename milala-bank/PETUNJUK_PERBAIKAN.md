# MILALA BANK — Hotfix Anggaran Family Finance (12 November 2026)

## Gejala
Setelah menyimpan anggota keluarga, saat menambahkan anggaran muncul:
`Data berubah di perangkat lain. Muat ulang fitur lalu coba lagi.`

## Penyebab
Server memakai transaksi Firebase Realtime Database dengan `revision`.
Pada cold start, update function dapat menerima cache awal `null` meskipun
workspace pada Firebase sudah ada. Update function yang lama menganggap
`revision` sebagai 0 dan langsung membatalkan penyimpanan kedua/dst.
Pengujian awal sebelumnya tidak mensimulasikan cold cache ini.

## Perubahan
- Backend menunggu snapshot awal dari listener RTDB sementara sebelum
  memulai transaksi; listener tetap aktif sampai transaksi selesai.
- Pemeriksaan `revision` **tetap di dalam transaksi**, sehingga konflik
  sebenarnya dari dua tab/perangkat tetap ditolak.
- Listener ditutup pada kondisi sukses maupun gagal.
- Tidak menyentuh milala_core_banking, skema transaksi, akun, atau data lama.

## Deploy dengan GitHub/Vercel
1. Backup project dan database Firebase yang sedang berjalan.
2. Di repo yang menayangkan `luissembiring.my.id`, pastikan project root
   adalah folder yang berisi `package.json`, `index.html`, `api`, dan `lib`.
3. GANTI HANYA `lib/banking.js` dengan file dari ZIP ini (di path yang sama).
   Boleh juga ganti `scripts/test-smart-finance.js` untuk regression test,
   dan `docs/SMART_FINANCE.md` sebagai dokumentasi.
4. Commit dan deploy ke project Vercel yang sama. Jangan reset Firebase,
   jangan ubah aturan akses, jangan membuat project backend baru.
5. Jika punya Node.js 22, jalankan `npm run check` sebelum deploy.
6. Setelah deploy selesai, refresh browser (Ctrl+F5), masuk lagi jika perlu.
   Buka Family Finance, tambah anggota, lalu tambah anggaran. Reload halaman
   dan periksa data tetap tersimpan. Uji juga edit/hapus anggaran.

## Status
Pengujian simulasi otomatis lulus: cold-cache, penambahan data kedua/ketiga,
konflik nyata, isolasi antar akun, dan menu lama.
Belum diuji end-to-end terhadap Firebase atau Vercel produksi.
