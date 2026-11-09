# Panduan setup — Firebase Spark + Vercel Serverless Functions

Panduan ini mempertahankan project dan Realtime Database MILALA BANK yang sudah ada. Tidak ada langkah yang membuat database baru atau menghapus `/milala_core_banking`.

> **Hanya simulasi pendidikan.** Jangan gunakan uang sungguhan, NIK asli, dokumen identitas, atau data rekening nyata.

## A. Prasyarat

- Firebase project: `luis-sistem-informasi`
- Project number: `592130766717`
- Realtime Database URL: `https://luis-sistem-informasi-default-rtdb.asia-southeast1.firebasedatabase.app`
- Database root: `/milala_core_banking`
- Node.js 22 LTS
- GitHub repository yang terhubung ke Vercel
- Firebase plan: Spark boleh dipertahankan

Firebase Spark mendukung Firebase Authentication email/password dan Realtime Database dalam kuota gratis. Cloud Functions Firebase tidak tersedia di Spark; karena itu backend ada di Vercel Functions. Vercel mempunyai batas pemakaian/kuota sendiri.

## B. Backup dan jangan reset database

Kamu sudah menyatakan backup Realtime Database selesai. Tetap simpan file backup itu di komputer, di luar repository GitHub.

Jangan:
- reset Realtime Database;
- mengimpor ulang seed/demo data ke database lama;
- menghapus `/milala_core_banking`;
- mengganti `databaseURL` ke project lain.

Node lama seperti `customers`, `accounts`, `transactions`, `journal`, `loans`, `branches`, `settings`, `counters`, `audit`, dan `users` tetap berada di `/milala_core_banking`.

## C. Aktifkan Firebase Authentication

1. Firebase Console → Authentication → Sign-in method.
2. Aktifkan Email/Password.
3. Authentication → Settings → Authorized domains.
4. Tambahkan domain Vercel (`your-project.vercel.app`) dan domain kustom yang dipakai.
5. Uji email verification dan password reset.

Password disimpan dan diverifikasi oleh Firebase Authentication, bukan di Realtime Database.

## D. Siapkan service account untuk Vercel (rahasia server)

Vercel Functions akan menggunakan Firebase Admin SDK. Admin SDK harus berjalan hanya di server tepercaya dan membutuhkan service account.

1. Firebase Console → Project settings → Service accounts.
2. Buat/generate private key untuk project `luis-sistem-informasi`.
3. Unduh JSON ke komputer pribadi.
4. Jangan taruh JSON itu di folder website, jangan commit ke GitHub, dan jangan kirim ke chat.
5. Di Vercel → Project → Settings → Environment Variables, buat:

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | `luis-sistem-informasi` |
| `FIREBASE_DATABASE_URL` | `https://luis-sistem-informasi-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Isi lengkap JSON service account |
| `APP_ORIGIN` | Origin website, misalnya `https://your-project.vercel.app` |

Untuk menyalin JSON sebagai satu baris di Windows PowerShell (ganti lokasi file dengan lokasi JSON milikmu):

```powershell
$sa = Get-Content -Raw "C:\PATH\firebase-service-account.json" | ConvertFrom-Json
$sa | ConvertTo-Json -Compress | Set-Clipboard
```

Lalu paste ke nilai `FIREBASE_SERVICE_ACCOUNT_JSON` di Vercel. Tandai sebagai secret/sensitive bila opsi itu tersedia. Pilih Production dan Preview (Development opsional). Jangan screenshot atau bagikan nilai private key.

Service account mempunyai hak istimewa untuk mengakses data. Gunakan hanya untuk API server ini, batasi orang yang dapat mengubah environment variables, dan rotasi key jika pernah terekspos.

## E. Upload website/API ke GitHub dan deploy Vercel

1. Ekstrak ZIP rilis Spark + Vercel.
2. Buka folder `milala-bank` di dalam ZIP.
3. Upload/replace isi folder tersebut ke root repository GitHub yang terhubung ke Vercel. Pastikan `index.html` ada pada root deployment (atau atur Vercel Root Directory ke folder tersebut).
4. Pastikan file `api/[action].js`, `lib/banking.js`, `package.json`, `vercel.json`, `database.rules.json`, `firebase.json`, `scripts/`, `assets/`, dan `docs/` ikut ter-upload.
5. Jangan upload folder `node_modules`, `backups`, atau JSON service account.
6. Commit dan tunggu deployment Vercel selesai.

Vercel otomatis mendeteksi file di folder `/api` sebagai Vercel Functions Node.js. `api/[action].js` melayani endpoint `/api/{action}`. Konfigurasi `vercel.json` memilih region Singapore (`sin1`) agar lebih dekat ke Realtime Database di `asia-southeast1`.

## F. Tes backend sebelum mengunci database

Setelah deployment:
1. Buka website Vercel dan cek halaman publik.
2. Buka Developer Tools → Network dan pastikan permintaan `POST /api/getPublicInfo` mendapat status 200.
3. Endpoint ini hanya mengembalikan nama institusi dan daftar cabang aktif.
4. Tes registrasi akun dummy, email verification, login, dan reset password.
5. Tes login staf setelah akun staf dimigrasikan.
6. Tes nasabah hanya melihat rekening/mutasi miliknya.

Jika API merespons 500, cek Vercel → Deployments → Functions/Logs. Periksa apakah environment variables tersedia untuk environment deployment yang sedang dibuka, apakah JSON service account valid, dan apakah `project_id` cocok.

`GET /api/getPublicInfo` dapat merespons 405 karena endpoint memakai POST. Itu normal.

## G. Migrasikan akun staf lama

Lakukan setelah service account tersedia dan sebelum menghapus data password lama.

Buka PowerShell di root proyek. Atur credential file lokal:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\PATH\firebase-service-account.json"
$env:FIREBASE_DATABASE_URL="https://luis-sistem-informasi-default-rtdb.asia-southeast1.firebasedatabase.app"
$env:FIREBASE_PROJECT_ID="luis-sistem-informasi"
npm install
node .\scripts\migrate-staff.js
```

Perintah tanpa `--apply` adalah dry-run. Skrip membuat backup lokal di folder `backups/`; backup dapat berisi password demo lama, jadi jangan dibagikan dan jangan commit ke GitHub.

Periksa email dan role staf pada hasil dry-run. Jika benar, jalankan:

```powershell
node .\scripts\migrate-staff.js --apply
```

Skrip:
- membuat atau memakai akun Firebase Authentication yang sesuai;
- menetapkan Custom Claims staf menggunakan Admin SDK;
- menambahkan UID ke profil staf;
- membuat `/milala_secure/staffProfiles/{uid}`;
- menghapus password plaintext staf dan customerUsers dari data aplikasi;
- mempertahankan customer, account, transaction, journal, loan, branch, settings, counter, dan audit lama.

Jika database berubah ketika migrasi berjalan, skrip memakai compare-and-swap transaction dan berhenti agar snapshot terbaru tidak ditimpa. Beberapa akun Auth mungkin sudah dibuat sebelum transaksi berhenti; periksa backup dan keadaan saat ini sebelum mengulang.

Akun nasabah lama tidak otomatis dipetakan ke Firebase Auth. Jangan menghubungkan nasabah lama hanya dengan email yang dikirim browser. Buat alur verifikasi kepemilikan terpisah jika perlu migrasi nasabah lama.

## H. Terapkan Realtime Database Security Rules (cutover)

**Lakukan hanya setelah Vercel API sudah berfungsi dan diuji.** Rules pada paket ini adalah default-deny:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

Dari root proyek:

```powershell
firebase login
firebase use luis-sistem-informasi
firebase deploy --only database
```

Rules ini memblokir semua akses langsung dari browser, termasuk user yang sudah login. Vercel API tetap dapat mengakses database karena Admin SDK berjalan di server dengan service account. Admin SDK mengabaikan Rules; karena itu setiap endpoint privat harus memverifikasi ID token dan role. Jangan pernah mengubah Rules menjadi `.read: true` atau `.write: true` untuk mengatasi error.

## I. Validasi lokal

Di root proyek:

```powershell
npm install
npm run check
```

Perintah ini memeriksa JSON, sintaks JS, route API, penggunaan Firebase Auth, dan default-deny Rules. Ini bukan pengganti pengujian live.

## J. Checklist pengujian wajib

- [ ] Email/Password aktif.
- [ ] Domain Vercel dan domain kustom ada di Authorized Domains.
- [ ] Vercel Environment Variables disimpan sebagai server-only secrets.
- [ ] `POST /api/getPublicInfo` merespons 200.
- [ ] Firebase ID token tidak valid/kedaluwarsa ditolak.
- [ ] Akun staf tanpa Custom Claims ditolak.
- [ ] Role staf yang tidak berwenang ditolak.
- [ ] Customer A tidak bisa melihat data Customer B.
- [ ] Customer tidak bisa menulis saldo, transaksi, jurnal, atau status kredit.
- [ ] Pengajuan kredit diverifikasi kepemilikan rekeningnya di server.
- [ ] Transaksi dan jurnal tervalidasi server-side.
- [ ] Akses langsung RTDB tanpa token ditolak.
- [ ] Akses langsung RTDB dengan token customer juga ditolak.
- [ ] Data lama `/milala_core_banking` masih ada dan jumlah record masuk akal.

## K. Batasan dan hardening lanjutan

- Admin SDK mempunyai akses administratif penuh ke Realtime Database dan melewati Security Rules. Secret service account harus dijaga ketat.
- Versi ini belum menerapkan rate limiting terdistribusi atau enforcement App Check pada API.
- Snapshot staf saat ini belum menerapkan pemfilteran data per cabang.
- Vercel dan Firebase mempunyai kuota/pembatasan masing-masing; monitor usage.
- Jalankan pengujian dengan akun dan data dummy, audit endpoint, dan lakukan review keamanan sebelum membuka pendaftaran publik.
- Ini aplikasi simulasi pendidikan, bukan core banking berizin dan bukan untuk uang sungguhan.
