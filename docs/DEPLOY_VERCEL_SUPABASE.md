# Deployment Vercel + Supabase

## Status terverifikasi — 4 November 2026

- URL aplikasi: https://dh-fleetsync.vercel.app/
- Akun Vercel: `jaelanisurya.akademicrypto@gmail.com`.
- Tim: `jay`, slug `jay-9d47`, ID `team_vGKzc3aPMU8IXYrZKDF2fprS`.
- Project: `dh-fleetsync`, ID `prj_kvKFofI7aRZdo1hA9h4p7OlQA8LJ`.
- Deployment: `dpl_BDGxTp9DBQMbFrWFUgv99soVaDRz`, READY, production alias aktif.
- Repository GitHub terhubung: `Jayszrs/DHLINEUP`, branch production `main`.
- Root Directory Vercel: `node-app`.
- Framework Express, Node.js 22, `npm ci`, build `npm run build`, fungsi di Singapura.
- Supabase Free dibuat lewat Marketplace dan terhubung ke development, preview, production.
- Schema PostgreSQL privat `fleetsync`: sembilan tabel, termasuk `email_recovery`. Bucket `fleetsync-private`: tidak publik.
- Snapshot lokal sudah dimigrasikan: 53 Line Up, 49 operator, satu akun, 54 riwayat, 105 gambar (102 bukti + 3 referensi).

## Batas paket dan penggunaan

Pengguna memilih tetap menggunakan **Vercel Hobby dan Supabase Free**; tidak ada Pro, trial berbayar, atau langganan berbayar yang diaktifkan. Hobby membatasi penggunaan ke personal/nonkomersial menurut ketentuan Vercel. Deployment teknis tidak mengubah ketentuan tersebut atau membuktikan kesesuaian untuk operasional perusahaan. Akses jaringan kantor belum diuji dari jaringan kantor.

Rujukan: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase Marketplace](https://supabase.com/docs/guides/integrations/vercel-marketplace).

## Konfigurasi

Marketplace memasang kredensial PostgreSQL dan Supabase sebagai environment variables pada project. Aplikasi menggunakan `DATABASE_URL` atau `POSTGRES_URL`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY` atau `SUPABASE_SECRET_KEY`. Kunci server tidak ditampilkan ke frontend.

Koneksi PostgreSQL memverifikasi CA dan hostname menggunakan sertifikat resmi Supabase di `node-app/backend/config/supabase-root.crt`. Verifikasi sertifikat tetap aktif. Pool aplikasi memakai satu koneksi untuk setiap instance fungsi dan query tanpa named prepared statements.

Sertifikat diambil dari URL resmi yang tercantum pada konfigurasi dashboard Supabase: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt.

## Akun aplikasi dan sumber data

Akun aplikasi `jayszrs` awalnya berasal dari snapshot lokal. Untuk memulihkan login pemilik setelah migrasi, kredensialnya sudah dikembalikan ke hash dari backup akun FleetSync online lama di InfinityFree. Gunakan password FleetSync online lama. Akun aplikasi terpisah dari akun Google/GitHub/Vercel/Supabase. Hash bcrypt lama kompatibel dengan runtime baru. Tidak ada password plaintext yang dimasukkan ke source deployment.

Rekonsiliasi hanya mengubah kredensial pemilik yang masih cocok dengan snapshot awal. Kredensial sebelum rekonsiliasi dicadangkan secara privat, sesi pemilik dicabut, dan tindakan dicatat pada riwayat. Data operasional tetap berasal dari snapshot Laragon.

Migrasi ini bersumber dari Laragon, bukan ekspor terbaru database InfinityFree. Website lama dipensiunkan atas permintaan pengguna pada 4 November 2026, setelah backup file terakhir diverifikasi. Database lama tidak tersinkron otomatis ke Supabase.

## Email pemulihan dan pembatasan login

Setelah lima kegagalan, login memberi jeda maksimal 30 detik per kombinasi username dan koneksi, dengan hitung mundur dan `Retry-After`. Pembatas lama selama 15 menit tidak lagi dipakai. Login dan pemulihan menggunakan pembatas terpisah.

Daftarkan email melalui Profil dengan password saat ini, lalu verifikasi kode yang dikirim ke email tersebut. Menu Lupa password hanya mengirim kode ke email terverifikasi yang sesuai dengan username. Kode reset berlaku 10 menit, sekali pakai, disimpan sebagai hash, dan reset mencabut semua sesi akun. Permintaan pengiriman dibatasi satu kali per menit.

SMTP perlu diaktifkan terpisah dari domain website. Website tetap memakai `dh-fleetsync.vercel.app`; Gmail bisa menjadi pengirim melalui `smtp.gmail.com:465` dengan App Password khusus dan Verifikasi 2 Langkah. Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` sebagai environment server yang dienkripsi, lalu redeploy. Jangan masukkan App Password ke Git atau chat. Selama kredensial SMTP belum tersedia, pengiriman belum aktif dan UI menyatakan status itu.

## Memperbarui aplikasi

Integrasi GitHub sudah terhubung melalui akun Vercel tujuan. Commit perubahan yang relevan lalu push ke `main` dari folder repository:

```powershell
git push origin main
```

Periksa deployment baru di https://vercel.com/jay-9d47/dh-fleetsync/deployments dan tunggu status Ready. Vercel membangun aplikasi dari `node-app` dengan `npm ci` dan `npm run build`. Root Directory penting karena root repository juga berisi versi PHP lama.

Login CLI untuk akun tujuan tetap disimpan terpisah di `node-app/.private/vercel`. Jika memakai CLI untuk pemeriksaan, sertakan `--scope jay-9d47` dan `--global-config C:\Users\jaela\Downloads\DHLINEUP\node-app\.private\vercel` agar tidak memakai akun CLI default untuk project lain. Perintah deploy lama dari subfolder tidak dipakai setelah Root Directory project diatur ke `node-app`.

Jangan membuat ulang resource Supabase atau mengimpor snapshot setiap kali memperbarui kode. Aset publik dibangun ke `public/assets`; gambar bukti dan snapshot tetap privat. File `.private`, `.env`, `.data`, dan konfigurasi lokal tidak dimasukkan ke Git.

## Setup agent mengikuti panduan Vercel

Panduan yang dibaca: https://vercel.com/get-started.md.

- CLI 62.4.0 sudah tersedia; akun target terverifikasi melalui CLI/API dan project dibuat pada tim yang benar.
- Installer `npx plugins add vercel/vercel-plugin --target codex --scope user --yes` melaporkan sukses. Pengaturan user mengaktifkan `vercel@openai-curated`.
- MCP global `vercel` memakai `https://mcp.vercel.com`; login OAuth berhasil.
- MCP global `supabase` memakai `https://mcp.supabase.com/mcp`; login OAuth berhasil.
- Pengaturan server lain dipertahankan.
- Tools MCP yang sudah dimuat pada sesi chat lama masih memperlihatkan tim Vercel sebelumnya, dan tools Supabase baru belum muncul pada sesi itu. Seluruh perubahan project dilakukan melalui CLI dengan akun/scope target yang terverifikasi. Reload Codex untuk memuat plugin dan koneksi MCP terbaru sebelum menggunakan tools MCP untuk mutasi akun target.

## Pemeriksaan

25 tes integrasi lokal lulus, termasuk verifikasi email, kode reset kedaluwarsa/sekali pakai, pencabutan sesi dan pembatas login baru. Build lokal dan build deployment sebelumnya berhasil. HTTP online `/health`, `/login`, CSS dan font memberi status 200; font cocok dengan file pengguna. Pemeriksaan cloud memverifikasi 105 checksum, akses anonim yang ditolak, CORS, unggah langsung, tiket sekali pakai, dan akses gambar privat. Pengiriman email ke inbox nyata perlu diverifikasi setelah kredensial SMTP tersedia.

Laporan teknis privat tersedia di `node-app/.private/cloud-verification.json`, `http-verification.json`, dan `integration.tap`. Snapshot privat berada di `node-app/.private/migration/local-snapshot.zip` dan tidak boleh dikirim sebagai source deployment. Kontrol Chrome belum dapat digunakan untuk verifikasi visual.
