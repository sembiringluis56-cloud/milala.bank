# Checklist Pengujian — MILALA BANK

Pengujian dilakukan terhadap versi ini menggunakan syntax check Node.js dan interaksi Chromium/Playwright. Karena kebijakan lingkungan penguji memblokir navigasi browser ke `file://` maupun `http://127.0.0.1`, HTML/CSS/JS dimasukkan langsung ke halaman browser yang memiliki mock storage. Ini menguji perilaku UI/JavaScript, **bukan** seluruh mekanisme browser file lokal. Pengujian manual di komputer pengguna tetap dianjurkan.

| Skenario | Status pengujian |
|---|---|
| Parse syntax 3 file JS | PASS — `node --check` |
| Login akun demo Super Admin | PASS |
| Membuka seluruh 15 menu | PASS |
| Tambah nasabah fiktif | PASS |
| Buka rekening nasabah | PASS |
| Setor tunai | PASS |
| Transfer internal | PASS |
| Ajukan kredit | PASS |
| Persetujuan / pencairan kredit | PASS |
| Angsuran pokok | PASS |
| Data tersimpan dalam storage | PASS |
| Pembatasan menu Auditor | PASS |
| Kesalahan runtime JavaScript pada alur di atas | Tidak ditemukan |
| Restore file di browser lokal asli | BELUM DIUJI |
| Penolakan tarik tunai melebihi saldo | PASS |
| Konsistensi pasangan jurnal pada 118 transaksi awal | PASS (semua penjumlahan nol) |
| Penolakan persetujuan kredit | PASS |
| Pergantian tema gelap | PASS |
| Tampilan mobile 375px dan navigasi hamburger | PASS (cek dasar, tidak ada overflow dokumen) |
| Rekening diblokir | BELUM DIUJI dalam browser (aturan tersedia dalam kode) |
| Pengujian lintas browser lain | BELUM DIUJI |
| Transaksi simultan lintas tab / race condition | TIDAK DIDUKUNG |
| Penetrasi keamanan / audit independen | TIDAK DILAKUKAN |

*Tidak ada klaim keamanan, kesesuaian regulasi, atau siap produksi.*
