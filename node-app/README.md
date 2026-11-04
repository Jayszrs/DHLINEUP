# DH FleetSync — JavaScript + Supabase

Versi tanpa PHP sudah diterbitkan di **https://dh-fleetsync.vercel.app/** pada 4 November 2026. Project Vercel `jay-9d47/dh-fleetsync` milik `jaelanisurya.akademicrypto@gmail.com` terhubung ke Supabase Free melalui Vercel Marketplace.

Repository GitHub `Jayszrs/DHLINEUP` sudah terhubung ke project tersebut. Branch production adalah `main` dan Root Directory Vercel adalah `node-app`. Perubahan yang didorong ke branch tersebut diproses oleh integrasi GitHub Vercel.

Backend memakai Node.js 22 dan Express. Frontend memakai HTML/EJS, CSS, JavaScript, dan font TT Firs Neue Bold dari pengguna. Database memakai PostgreSQL pada schema privat `fleetsync`; gambar disimpan di bucket privat `fleetsync-private`.

## Menjalankan di laptop

```powershell
cd node-app
npm ci
npm start
```

Buka `http://127.0.0.1:8090`. Jika `.env` belum berisi koneksi cloud, aplikasi memakai PostgreSQL lokal PGlite di `.data/postgres`, tanpa PHP atau MySQL. Build template dan aset dijalankan otomatis oleh `npm start`.

Konfigurasi contoh tersedia di `.env.example`. Koneksi Marketplace juga dapat menggunakan `POSTGRES_URL`, `SUPABASE_URL`, dan `SUPABASE_SECRET_KEY` secara langsung. File `.env`, `.private`, `.data`, dan `.vercel` tidak dimasukkan ke Git atau source deployment.

## Struktur

```text
backend/src/       Routing, autentikasi, validasi, PostgreSQL, penyimpanan, spreadsheet
backend/cli/       Inisialisasi, build aset, ekspor/import snapshot
backend/config/    Sertifikat CA Supabase untuk verifikasi TLS
frontend/views/   Template HTML/EJS dan halaman
frontend/assets/  CSS, JavaScript, logo, font
database/         Schema PostgreSQL
public/assets/    Aset publik hasil build
tests/            Tes integrasi dengan PostgreSQL sementara
```

`frontend/views.generated.js` dihasilkan dari template ketika build. Ini memastikan halaman tersedia di bundle Vercel tanpa bergantung pada penelusuran file template saat runtime. Berkas sumber utama tetap berada di `frontend/views`.

## Fitur

Login, pembatasan percobaan login, CSRF, akun pertama dengan aktivasi hosting, profil, akun tambahan dengan akses Pengelola yang sama, CRUD Line Up dan Master Operator, dashboard, audit, bukti gambar, impor/ekspor XLSX dan CSV, tema putih/gelap, hamburger, serta font pengguna dipertahankan.

Impor maksimal 10 MB/5.000 baris dan gambar maksimal 5 MB. Di Vercel, browser mengunggah file langsung ke Supabase menggunakan tiket sementara yang terikat pengguna. Backend memeriksa kembali jenis, ukuran, kepemilikan dan masa berlaku sebelum menyimpan data. Gambar yang dibuka memerlukan login lalu mendapat URL berumur singkat.

## Data migrasi

Snapshot **database lokal Laragon** sudah dimasukkan: 53 Line Up, 49 operator, satu akun `jayszrs`, 54 riwayat, 102 bukti, dan tiga referensi gambar. Setelah migrasi, kredensial akun pemilik `jayszrs` dipulihkan dari backup akun FleetSync online lama di InfinityFree. Gunakan password FleetSync online lama; akun ini terpisah dari Google, GitHub, Vercel, dan Supabase. Password tetap disimpan sebagai hash.

Website InfinityFree lama tetap terpisah. Perubahan setelah snapshot di alamat lama tidak otomatis masuk ke Supabase. Pastikan sumber data terbaru disepakati sebelum beralih penggunaan sepenuhnya.

Snapshot dapat dibuat dan diuji ulang melalui CLI:

```powershell
node backend/cli/export-mysql.js
node backend/cli/import-snapshot.js .private/migration/local-snapshot.zip
```

Ekspor hanya membaca MySQL sumber dan menyimpan paket privat. Import snapshot yang sama dilewati; snapshot berbeda ditolak jika tujuan sudah berisi akun atau data. Jangan mengunggah snapshot ke direktori publik.

## Validasi

- `npm test`: 18 tes integrasi lulus memakai PostgreSQL sementara.
- Build Vercel berhasil dan deployment berstatus READY.
- Endpoint online `/health` mengembalikan HTTP 200 dengan runtime Node.
- Halaman login, CSS, dan font online mengembalikan HTTP 200; font sama persis dengan file pengguna.
- 105 gambar di Supabase cocok checksum sumber; akses anonim ke schema dan gambar ditolak.
- Unggah langsung, preflight CORS, tiket sekali pakai, dan pembacaan gambar privat berhasil diuji dengan gambar uji yang kemudian dibersihkan.

Pemeriksaan visual melalui Chrome belum tersedia karena alat kontrol browser mengalami error. Tes jaringan kantor harus dilakukan dari jaringan kantor yang sebenarnya.

Panduan deployment dan status akun ada di [docs/DEPLOY_VERCEL_SUPABASE.md](../docs/DEPLOY_VERCEL_SUPABASE.md).
