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

Login, pembatasan percobaan login, CSRF, akun pertama dengan aktivasi hosting, profil, akun tambahan sebagai Pengelola, CRUD Line Up dan Operator sesuai izin, dashboard, audit, bukti gambar, impor/ekspor XLSX dan CSV, tema putih/gelap, hamburger, serta font pengguna dipertahankan.

Nama operator dan kode unit pada Line Up dapat diklik langsung untuk membuka detail. Nama pada daftar Operator membuka profil. Tombol Detail/Edit/Hapus tersedia per baris sesuai izin; penghapusan tetap meminta konfirmasi dan memeriksa versi data. Penghapusan profil Operator tidak menghapus identitas/snapshot pada riwayat Line Up; data profil sebelumnya dicatat di audit. Penyimpanan penugasan berikutnya dapat membentuk kembali profil berdasarkan NIK.

Sesuai pilihan pemilik, akun `jayszrs`, `tnazwar`, dan `yuliantobudi` memiliki `can_edit_data=true`; semua Administrator juga punya akses penuh. Pengelola lain hanya dapat melihat/mengekspor data, termasuk profil Operator dalam mode baca. Form tambah/edit, impor, unggah, dan POST perubahan ditolak server untuk akun tanpa izin. Izin disimpan pada ID akun sehingga tetap berlaku jika username diganti. Akun baru secara default tidak mendapat izin edit data.

Logo menggunakan simbol transparan resolusi tinggi dari referensi pengguna; tulisan DH mengikuti tema (hitam saat terang, putih saat gelap). Favicon memakai simbol tanpa tulisan. Aset aktif `frontend/assets/dh-symbol.png` disiapkan melalui tool imagegen dan disertakan ke aset publik saat build.

Login memberi jeda maksimal 30 detik setelah lima percobaan gagal pada kombinasi username dan alamat IP, dengan hitung mundur serta header `Retry-After`. Percobaan untuk username lain pada jaringan yang sama tidak ikut terkunci.

Menu **Lupa password** sementara mengarahkan pengguna untuk meminta bantuan administrator. Administrator pemilik `jayszrs` dapat membuka **Kelola Akun > Reset password**, mengonfirmasi password sendiri, lalu menetapkan password sementara bagi pengguna lain. Semua sesi pengguna tersebut dicabut, dan pengguna wajib mengganti password sebelum dapat mengakses data lagi. Password tidak ditampilkan dalam audit.

Menu nama akun menyediakan **Edit profil** untuk nama/username dan **Ganti password** untuk mengganti password sendiri dengan konfirmasi password saat ini. Ganti password mencabut semua sesi dan meminta login kembali. Pengelola dapat membuat akun lainnya, tetapi izin edit data tidak dapat diperoleh dari formulir pembuatan akun. Hanya administrator yang dapat mereset password pengguna lain. Akun pertama menjadi administrator, dan migrasi akun lama menetapkan pemilik pertama sebagai administrator.

Administrator juga dapat membuka **Kelola Akun > Edit profil & role** pada akun mana pun untuk mengubah nama, username, dan role **Pengelola/Administrator**. Penyimpanan membutuhkan password administrator. Perubahan username/role mencabut sesi akun yang diedit dan dicatat di audit. Form lama ditolak jika data sudah diubah administrator lain. Penurunan role administrator terakhir ditolak, termasuk saat beberapa perubahan dilakukan bersamaan.

Kode pemulihan email tetap tersedia untuk penggunaan mendatang jika SMTP diaktifkan; pengiriman email saat ini tidak digunakan. Tidak ada App Password atau konfigurasi email tambahan yang diperlukan untuk alur administrator.

Impor maksimal 10 MB/5.000 baris dan gambar maksimal 5 MB. Di Vercel, browser mengunggah file langsung ke Supabase menggunakan tiket sementara yang terikat pengguna. Backend memeriksa kembali jenis, ukuran, kepemilikan dan masa berlaku sebelum menyimpan data. Gambar yang dibuka memerlukan login lalu mendapat URL berumur singkat.

Form dan detail Line Up tidak lagi menampilkan Status Sumber/Catatan. Nilai historis tetap tersimpan dan tidak dikosongkan jika kedua kolom tidak dikirim saat edit; kompatibilitas impor/ekspor data lama tetap tersedia. Bukti FTW dan Mine Dispatch menampilkan preview lokal segera setelah gambar dipilih, dengan nama/ukuran file, status belum disimpan, tombol batal dan pembesaran gambar. Preview tidak mengunggah file sebelum Simpan. Bukti lama ditampilkan saat edit dan kembali muncul jika pilihan penggantinya dibatalkan. Validasi browser menolak format selain PNG/JPG/WebP, gambar yang tidak dapat dibaca, dan ukuran lebih dari 5 MB; validasi backend tetap berlaku.

## Data migrasi

Snapshot **database lokal Laragon** sudah dimasukkan: 53 Line Up, 49 operator, satu akun `jayszrs`, 54 riwayat, 102 bukti, dan tiga referensi gambar. Setelah migrasi, kredensial akun pemilik `jayszrs` dipulihkan dari backup akun FleetSync online lama di InfinityFree. Gunakan password FleetSync online lama; akun ini terpisah dari Google, GitHub, Vercel, dan Supabase. Password tetap disimpan sebagai hash.

Website InfinityFree lama dipensiunkan atas permintaan pengguna pada 4 November 2026. Backup terakhir disimpan privat sebelum file website dihapus. Sumber aplikasi aktif adalah Vercel dengan database Supabase; perubahan lama setelah snapshot tidak tersinkron otomatis.

Snapshot dapat dibuat dan diuji ulang melalui CLI:

```powershell
node backend/cli/export-mysql.js
node backend/cli/import-snapshot.js .private/migration/local-snapshot.zip
```

Ekspor hanya membaca MySQL sumber dan menyimpan paket privat. Import snapshot yang sama dilewati; snapshot berbeda ditolak jika tujuan sudah berisi akun atau data. Jangan mengunggah snapshot ke direktori publik.

## Validasi

- `npm test`: 44 tes integrasi lulus memakai PostgreSQL sementara, termasuk edit profil/role oleh administrator, pencegahan hilangnya administrator terakhir, reset password, password sementara wajib diganti, pemulihan email dan jeda login.
- Build Vercel berhasil dan deployment berstatus READY.
- Endpoint online `/health` mengembalikan HTTP 200 dengan runtime Node.
- Halaman login, CSS, dan font online mengembalikan HTTP 200; font sama persis dengan file pengguna.
- 105 gambar di Supabase cocok checksum sumber; akses anonim ke schema dan gambar ditolak.
- Unggah langsung, preflight CORS, tiket sekali pakai, dan pembacaan gambar privat berhasil diuji dengan gambar uji yang kemudian dibersihkan.

REA menjalankan Chrome dengan data contoh terpisah untuk memverifikasi klik nama ke detail/profil, tampilan desktop terang/gelap, form ponsel, dan profil Operator dalam mode baca; tidak ada page error pada skenario tersebut. Akun/data produksi tidak dipakai untuk pengujian visual. Tes jaringan kantor harus dilakukan dari jaringan kantor yang sebenarnya.

Panduan deployment dan status akun ada di [docs/DEPLOY_VERCEL_SUPABASE.md](../docs/DEPLOY_VERCEL_SUPABASE.md).
