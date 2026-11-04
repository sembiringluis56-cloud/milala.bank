# MILALA BANK — Core Banking System (Simulasi)

**Versi prototipe frontend offline: HTML5, CSS3, JavaScript ES6+ (tanpa framework, server, database, atau dependensi eksternal).**

> **PENTING: MILALA BANK ADALAH SISTEM DEMO FIKTIF, BUKAN BANK NYATA.** Seluruh nomor rekening, KYC, transaksi dan nominal uang hanya data latihan. **Jangan masukkan NIK, nomor rekening asli, password asli, dokumen nasabah, ataupun data sensitif.** Tidak ada transfer uang, pembukaan rekening sebenarnya, autentikasi aman, enkripsi di server, sistem antifraud, dan kepatuhan bank. Jangan gunakan untuk operasi perbankan nyata.

## 1. Cara menjalankan

1. Ekstrak file `MILALA_BANK_Core_Banking_System.zip`.
2. Buka folder `milala-bank/`.
3. **Buka `index.html` melalui browser modern** (Chrome/Edge/Firefox) dengan klik dua kali.
4. Login dengan salah satu akun demo di bawah.
5. Semua perubahan data demo tersimpan lokal di browser melalui `localStorage`. Sesi login berlaku sepanjang tab browser masih menggunakan `sessionStorage`.
6. Jika browser memblokir penyimpanan untuk halaman file lokal, buka lewat server statis lokal pilihan Anda; tidak diperlukan aplikasi backend.

Sistem menggunakan file skrip klasik dengan `defer`, sehingga **tidak membutuhkan ES module import, npm, package manager, backend, atau jaringan internet**.

## 2. Akun demo

| Role | Email | Password | Keterangan |
|---|---|---|---|
| Super Admin | admin@milala.demo | Admin123! | Semua fitur |
| Customer Service | cs@milala.demo | Cs12345! | Nasabah, rekening, pengajuan kredit |
| Teller | teller@milala.demo | Teller123! | Setor/tarik, transfer, angsuran |
| Branch Manager | manager@milala.demo | Manager123! | Persetujuan kredit dan laporan |
| Auditor | auditor@milala.demo | Auditor123! | Laporan, buku jurnal, log (baca saja) |

Akun/password demo disimpan di LocalStorage dalam bentuk plaintext; **hanya cocok untuk simulasi**.

## 3. Modul yang disediakan

1. **Login, Logout, Profil** — autentikasi dan pengubahan password lokal untuk demo.
2. **Dashboard** — jumlah nasabah, agregat saldo, rekening aktif, kredit berjalan, grafik, transaksi terakhir dan aksi cepat.
3. **Manajemen Nasabah** — tambah, detail, edit, nonaktif, filter dan cari. ID KYC selalu dummy.
4. **Manajemen Rekening** — pembukaan nomor virtual unik `ML-*`, jenis tabungan/giro/deposito, lihat saldo/detail, blokir dan tutup (saldo harus nol).
5. **Setor & Tarik Tunai** — cek nominal dan status rekening, pencatatan kas demo dan journal entries.
6. **Transfer Internal** — pindah buku antar-rekening virtual bank yang sama, pemeriksaan saldo, pencatatan referensi.
7. **Mutasi & Rekening Koran** — debit/kredit, saldo berjalan, filter periode, ekspor CSV, cetak.
8. **Manajemen Kredit** — pengajuan, riwayat, outstanding pokok, dan angsuran pokok.
9. **Persetujuan Kredit** — setuju + pencairan ke rekening simulasi, atau tolak.
10. **Laporan** — laporan nasabah, rekening, transaksi dan kredit; filter tanggal/cabang; CSV, JSON dan cetak.
11. **Jurnal** — model debit/kredit berpasangan dengan pengecekan kesetimbangan per transaksi.
12. **Audit Log** — aktivitas login, mutasi data, transaksi, approval dan perubahan password demo.
13. **Cabang** — daftar cabang, tambah dan edit oleh Super Admin.
14. **Manajemen Pengguna** — tambah dan edit user demo, pengubahan role, penonaktifan.
15. **Pengaturan** — nama bank, tema gelap/terang, backup, restore, dan reset data simulasi.

Tampilan responsif untuk desktop, tablet, dan perangkat seluler. Tidak ada tombol utama yang sengaja dibiarkan tanpa aksi.

## 4. Alur bisnis

### A. Rekening & transaksi

```text
Registrasi Nasabah -> Buka Rekening (Saldo 0) -> Setor Tunai ->
Transfer Internal / Tarik Tunai -> Mutasi Rekening -> Laporan
```

Setiap transaksi menciptakan satu objek `transactions` dan dua entri dalam `journal` (sumber bernilai negatif, tujuan positif), kemudian seluruh perubahan dipersiapkan sebelum ditulis sebagai **satu dokumen JSON LocalStorage**. Model ini hanya simulasi dan tidak memiliki jaminan atomisitas, isolasi, konsistensi lintas tab, atau durability seperti database produksi.

### B. Kredit

```text
Ajukan Kredit -> Menunggu Persetujuan -> Disetujui/Ditolak
                                         |
                                         v
                                  Pencairan Kredit
                                         |
                                         v
                                  Angsuran Pokok
                                         |
                                         v
                                      Lunas
```

**Perhitungan kredit adalah contoh yang disederhanakan:** suku bunga tahunan hanya metadata dan *tidak* dihitung pada angsuran. Tidak ada bunga efektif, bunga berjalan, denda, provisi, jadwal amortisasi, penilaian kredit, pencadangan, NPL, maupun laporan regulator.

### C. Pembatasan data

- Nominal rupiah selalu bilangan bulat positif, maksimal Rp10 miliar per transaksi demo.
- Transaksi keluar ditolak bila saldo tidak cukup.
- Transfer ditolak bila rekening sumber dan tujuan sama.
- Rekening nonaktif/blokir tidak dapat bertransaksi.
- Nomor rekening virtual tidak boleh duplikat.
- Rekening tidak dapat ditutup dengan saldo bukan nol.
- Nasabah dengan rekening aktif tidak dapat dinonaktifkan.
- Kredit hanya dapat dicairkan melalui persetujuan role Admin/Manager.
- Pengajuan kredit ditolak tidak dapat dicairkan.
- Role dibatasi pada UI dan aksi JavaScript, **bukan otorisasi aman**.
- Data nasabah, cabang, rekening dan riwayat tidak dihapus permanen melalui UI; penonaktifan dan blokir mempertahankan relasi audit.

## 5. Struktur file

```text
milala-bank/
├── index.html
├── README.md
├── assets/
│   ├── css/
│   │   └── style.css        # Responsive design, login, dashboard, forms, print
│   └── js/
│       ├── seed.js          # Data fiktif awal dan akun demo
│       ├── store.js         # Akses LocalStorage, validasi backup, saldo jurnal
│       └── app.js           # UI SPA, role, CRUD, transaksi, kredit, laporan
└── docs/
    ├── ERD.md
    ├── use-case.md
    ├── activity-diagram.md
    ├── sequence-diagram.md
    ├── class-diagram.md
    ├── flowchart.md
    └── TESTING.md
```

Diagram menggunakan Mermaid; tampilkan di GitHub atau editor Markdown yang mendukung Mermaid.

## 6. Penyimpanan data

Data disimpan dalam satu root object di `localStorage` dengan key `milala_core_banking_demo_v1`:

- `users`, `branches`, `customers`, `accounts`
- `transactions`, `journal`, `loans`, `audit`
- `settings`, `counters`, `version`

Saldo rekening **dihitung** dari jumlah `journal.delta`, bukan disimpan sebagai nilai saldo yang diedit bebas. Entri pertama dalam demo berasal dari sumber simulasi `GL-CASH`. Pencairan kredit menggunakan `GL-LOANFUND` sebagai akun sumber fiktif. Nilai `debit(-)` dan `kredit(+)` di UI adalah perubahan saldo simulasi, bukan definisi debit/kredit akuntansi neraca bank.

### Backup / Restore

1. Masuk sebagai **Super Admin**.
2. Buka menu **Pengaturan Sistem**.
3. Klik **Backup JSON** untuk mengunduh seluruh data demo.
4. Untuk memulihkan, pilih **Restore JSON**, pilih file `.json`, lalu konfirmasi.
5. Restore memeriksa struktur pokok, jumlah jurnal per referensi harus nol, nilai numerik dan keunikan nomor rekening. **Validasi ini tidak memadai untuk file tak tepercaya atau produksi.**
6. Klik **Reset Data Demo** untuk kembali ke data fiktif bawaan.

Backup dapat memuat seluruh akun demo beserta passwordnya; simpan hanya untuk latihan.

## 7. Data awal

- 5 pengguna demo dengan 5 role berbeda.
- 3 cabang fiktif.
- 20 nasabah fiktif.
- 26 rekening virtual.
- Lebih dari 100 transaksi dan dua entri jurnal tiap transaksi.
- 10 data kredit (status pending, approved, lunas, ditolak).
- Log aktivitas contoh.

## 8. Pengujian yang dilakukan

- Sintaks tiga file JavaScript diuji dengan `node --check`.
- Antarmuka diuji melalui Chromium + Playwright dengan file HTML/CSS/JS dimasukkan ke halaman pengujian yang memiliki simulasi storage lokal (akses ke URL `file://` dan `localhost` dari penguji diblokir oleh kebijakan lingkungan).
- Alur diuji: login, tambah nasabah, pembukaan rekening, setoran, transfer, pengajuan kredit, approval, angsuran, navigasi 15 menu, persistensi data pada storage, pembatasan menu role Auditor, penolakan overdraft, pengecekan kesetimbangan jurnal awal, penolakan kredit, pergantian tema dan tampilan mobile 375px.
- Tidak ditemukan error JavaScript selama alur yang diuji. Rincian dan batasan dicatat di `docs/TESTING.md`.
- **Belum dilakukan** pengujian lintas browser, penetrasi keamanan, stress/load, konkurensi lintas tab, maupun validasi transaksi ke bank sungguhan.

## 9. Pengembangan lanjutan yang diperlukan untuk core banking nyata

Arsitektur aplikasi ini **tidak** bisa digunakan untuk transaksi uang sesungguhnya. Produk bank nyata memerlukan backend terisolasi, database ACID, account ledger sesuai standar, audit log immutable, kontrol akses server-side, autentikasi dan MFA, enkripsi, key management, maker-checker, antifraud, pemantauan transaksi, KYC/AML sesuai hukum yang berlaku, disaster recovery, pengujian keamanan independen, integrasi pembayaran resmi, sistem monitoring, kebijakan privasi, dan penilaian regulator. Jangan mencoba menghubungkan prototipe ini dengan rekening atau layanan bank nyata.

**MILALA BANK — Banking operations reimagined. (Demo pendidikan)**
