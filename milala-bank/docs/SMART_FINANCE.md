# MILALA BANK — Smart Finance Ecosystem

## Apa yang ditambahkan (tanpa mengganti core banking)

Paket ini menambahkan **11 menu** (10 modul referensi + Feedback) ke **Portal Nasabah** dan **Workspace Staf**. Feedback juga dapat dibuka dari homepage publik. Admin/manager mendapat menu tambahan **Feedback Masuk** untuk membaca 100 feedback terakhir.

| Menu | Operasi yang disediakan | Batasan simulasi |
| --- | --- | --- |
| Dashboard Keuangan | Ringkasan saldo simulasi MILALA, saldo bank manual, pemasukan/pengeluaran, target, aktivitas | Tidak menggabungkan uang nyata |
| AI Assistant | Jawaban berbasis aturan atas saldo, pengeluaran, pemasukan, target dan tagihan | Bukan chatbot AI generatif; memerlukan provider/key server untuk LLM asli |
| Analisis Keuangan | Grafik cash flow 6 bulan dan ringkasan transaksi manual | Berdasarkan catatan yang dimasukkan |
| Multi-Bank | Tambah, edit, hapus akun bank eksternal dan saldo manual | Tidak ada API bank eksternal, tidak dapat transfer |
| Target Tabungan | CRUD target dan catatan alokasi dana | Alokasi bersifat pencatatan; tidak memotong saldo inti |
| Invoice & Tagihan | CRUD invoice/tagihan, jatuh tempo, status lunas | Tidak memproses pembayaran |
| Manajemen Bisnis | CRUD buku kas pemasukan/pengeluaran, kategori, CSV | Data manual, bukan akuntansi pajak |
| Security Center | Ganti password Firebase (dengan re-autentikasi), info perlindungan | Tidak mengklaim MFA/2FA yang belum diimplementasikan |
| Laporan Keuangan | Ekspor catatan manual dan invoice CSV | Laporan bank resmi tetap berada di menu lama yang role-restricted |
| Family Finance | CRUD daftar anggota dan anggaran keluarga | Tidak ada undangan, berbagi antar akun, atau pengeluaran otomatis |
| Feedback | Form saran/bug/apresiasi dengan validasi; admin/manager dapat meninjau | Penerimaan publik dibatasi ~1 per menit per IP hashed, tanpa CAPTCHA |

**Bahasa:** Indonesia, English, dan 中文 (Simplified Chinese). Semua layar Smart Finance dan menu barunya tersedia dalam ketiga bahasa. Label/navigasi utama halaman lama memiliki terjemahan tambahan; beberapa uraian panjang legacy masih menampilkan bahasa aslinya demi tidak mengubah logika halaman lama.

## Integrasi ke aplikasi yang sudah ada

- **Tidak ada perubahan path `/milala_core_banking`.** Rekening, transaksi, kredit, jurnal, admin, dan hak akses lama tidak dimodifikasi oleh fitur Smart Finance.
- Data keuangan tambahan disimpan melalui API bertoken Firebase di `/milala_secure/financeWorkspaces/{firebaseUID}`. Setiap akun hanya boleh membaca/menulis datanya sendiri; server menguji profil/role.
- Feedback disimpan ke `/milala_secure/feedback`, dengan pembatasan kecepatan per identitas pengirim. Inbox feedback hanya dapat dibaca admin dan manager.
- `database.rules.json` tetap deny-all untuk akses browser langsung; tidak ada credential Firebase Admin pada JavaScript frontend.
- Bahasa antarmuka disimpan sebagai preferensi **non-sensitif** di `localStorage`, sedangkan data finansial tersimpan di Firebase melalui backend yang terautentikasi.
- Saat ada pengeditan serentak, API menolak revisi workspace yang usang dan meminta pengguna memuat ulang; tidak menimpa perubahan orang/perangkat lain.

## Deploy ke Vercel dan domain luissembiring.my.id

1. **Backup deployment Vercel dan Firebase Realtime Database** yang sedang dipakai. Jangan pernah menghapus database yang sudah ada, mengubah project ID, atau melakukan inisialisasi ulang ledger.
2. Ekstrak ZIP. **Gunakan folder `milala-bank/` di level pertama sebagai project root** (yang memuat `package.json`, `index.html`, `api`, `lib`, `assets`, `vercel.json`). Arsip asal mempunyai folder duplikat `milala-bank/milala-bank/`; salinan itu juga diperbarui demi kompatibilitas, tetapi jangan pilih salinan dalam saat mengatur Root Directory.
3. Pastikan Vercel Project yang menaungi `luissembiring.my.id` diarahkan ke repo/folder ini. Upload commit baru ke branch deployment yang **sama**; jangan membuat project Firebase/Vercel pengganti.
4. Di Vercel → Project Settings → Environment Variables, pastikan variabel yang digunakan backend lama **tetap** diatur: `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`, dan `APP_ORIGIN` (origin website aktif). Jangan unggah service-account JSON ke repo/ZIP.
5. Jalankan `npm install` (Node 22) dan `npm run check` di folder project. Hasil pengujian otomatis menguji sintaks, baseline keamanan, isolasi workspace, validasi, feedback, dan rendering modul.
6. Deploy ke Vercel yang sama. Bila domain kustom sudah terhubung dengan project tersebut, tidak perlu memindahkan DNS.
7. Verifikasi bertahap memakai **akun simulasi**, bukan rekening/dokumen asli: homepage masih terbuka, login nasabah berhasil, admin/staf dapat membuka semua menu lama, fitur baru bisa tambah/edit/hapus, laporan CSV terunduh, feedback terkirim dan terbaca admin, serta bahasa dapat diganti pada desktop/ponsel.
8. Baru gunakan di lingkungan demo setelah pengecekan di staging dan review keamanan. Jangan gunakan untuk uang sungguhan, bank API, atau informasi pribadi nyata.

## Jalur API tambahan

- `POST /api/getFinanceWorkspace` — login staf/nasabah wajib.
- `POST /api/saveFinanceWorkspace` — login wajib, pemilik UID saja, `expectedRevision` wajib.
- `POST /api/submitFeedback` — publik, validasi konten, honeypot, cooldown server-side.
- `POST /api/getFeedback` — login staf role `admin` atau `manager` wajib.

Semua endpoint baru ditambahkan ke router API yang sudah ada dan meniru pola error yang sama. Tidak ada endpoint lama yang dihapus.

## Hotfix: konflik palsu saat menyimpan data (12 November 2026)

- Bila setelah menambahkan anggota keluarga penyimpanan anggaran menampilkan `Data berubah di perangkat lain`, penyebabnya dapat berupa transaksi Firebase yang dimulai dengan cache `null`, bukan perubahan dari pengguna lain.
- Versi hotfix ini memasang listener sementara pada workspace milik UID sebelum melakukan transaksi, lalu menutupnya setelah commit. Pengecekan `revision` tetap dilakukan di dalam transaksi agar perubahan serentak tetap ditolak.
- **Cukup deploy `lib/banking.js`** dari hotfix ini ke project yang sedang aktif; tidak perlu menghapus anggota keluarga atau mengosongkan Firebase.
- Uji: simpan anggota keluarga, lalu tambah/edit anggaran, tutup/buka halaman, dan pastikan revisinya bertambah. Uji dengan dua sesi untuk memastikan revisi lama tetap ditolak.

## Troubleshooting

- Jika halaman awal menulis **Backend Vercel belum siap**, periksa environment variables dan status fungsi Vercel/API lama terlebih dahulu.
- Jika fitur baru muncul tetapi data gagal disimpan, pastikan versi baru `api/[action].js` **dan** `lib/banking.js` sudah ikut ter-deploy. Frontend saja tidak cukup.
- Jika workspace gagal dimuat karena `permission-denied`, pastikan akun telah diverifikasi/memiliki profil aktif; frontend tidak boleh mengambil data langsung dari RTDB.
- Jika feedback menampilkan tunggu ~1 menit, throttle sedang aktif untuk mencegah spam.
- Jika halaman lama tidak seluruhnya terjemah, terjemahan di-addon bersifat bertahap; seluruh fitur inti tetap bekerja dengan istilah bahasa asli.

## Tes yang dilakukan di paket ini

`npm run check` menjalankan pemeriksaan sintaks, aturan RTDB, pengujian backend Firebase in-memory, dan smoke test render/CRUD modul tanpa menyentuh Firebase live. Pengujian end-to-end melalui domain produksi **belum** dilakukan; deployment dan kredensial server tidak tersedia melalui ZIP.
