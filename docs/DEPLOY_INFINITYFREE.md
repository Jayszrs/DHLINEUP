# Deployment InfinityFree

Website: **https://ptdh.xo.je/**

- Akun InfinityFree: `jaelanisuryasaputra@gmail.com`
- Akun hosting: `if0_43345481`
- Paket: Free
- MySQL host: `sql301.infinityfree.com`
- Database: `if0_43345481_fleetsync`
- Folder aplikasi: `/htdocs`
- Pintu masuk: `/public/index.php` melalui redirect dari `/index.php`

Password hosting/database tidak dicatat di dokumen ini. Konfigurasi aktif ada di File Manager: `/htdocs/backend/config/local.php`.

## Data yang diunggah

Sesuai pilihan pengguna, versi online mulai dengan **database kosong**. Schema enam tabel sudah diimpor melalui phpMyAdmin. Data 53 Line Up, 49 operator, 102 gambar bukti, tiga gambar referensi, akun lokal, audit lokal, dan unggahan lokal **tidak disertakan**.

## Membuat akun aplikasi pertama

Buka website menggunakan HTTPS. Masukkan kode aktivasi dari file lokal `dist/infinityfree/activation-code.txt`, lalu isi nama, username, password, dan konfirmasi password sendiri. Kode tersebut tidak diunggah sebagai file publik; hosting hanya menyimpan hash-nya.

Setup otomatis ditutup setelah akun pertama berhasil dibuat. Kode aktivasi tidak dapat membuat akun kedua. Password tidak perlu dikirim melalui chat.

## Paket deployment

Paket awal:

```powershell
& 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe' backend\cli\package-infinityfree.php --domain=ptdh.xo.je
```

Hasilnya berada di `dist/infinityfree`:

- `htdocs.zip`: aplikasi untuk instalasi pertama, termasuk template konfigurasi database.
- `database-empty.sql`: schema tanpa data operator.
- `activation-code.txt`: kode aktivasi pemilik. **Simpan lokal; jangan upload.**
- `manifest.json`: daftar file dan keterangan paket tanpa data sumber.

Untuk memperbarui aplikasi yang sudah online, gunakan paket khusus agar password database aktif tidak tertimpa:

```powershell
& 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe' backend\cli\package-infinityfree.php --domain=ptdh.xo.je --update
```

Upload dan ekstrak **`htdocs-update.zip`** ke `/htdocs` melalui File Manager. Paket update tidak menyertakan `backend/config/local.php`, data seed, gambar sumber, ataupun isi unggahan dan log lokal. File runtime yang sudah ada tidak dihapus.

Jangan mengimpor ulang SQL untuk update kode biasa. Jangan mengunggah seluruh folder project, folder `.git`, `legacy`, `tests`, atau file kode aktivasi.

## Verifikasi

- Login InfinityFree memakai akun Google yang diminta pengguna.
- Akun hosting aktif dan subdomain `ptdh.xo.je` tersedia.
- Schema berhasil diimpor: phpMyAdmin melaporkan delapan query selesai.
- Enam tabel tersedia; Line Up dan Master Operator kosong.
- Paket aplikasi berhasil diunggah dan diekstrak ke `/htdocs`.
- Konfigurasi database aktif disimpan lewat editor File Manager, tanpa mencetak password ke output.
- Website menampilkan halaman setup FleetSync melalui HTTPS dengan koneksi MySQL berhasil.
- Permintaan langsung ke `/backend/config/local.php` ditolak dengan halaman 403.
- Akses HTTP dialihkan ke HTTPS.
- 62 tes integrasi lokal dan sembilan tes aktivasi/deployment lulus. Pengujian lokal memakai database sementara, bukan database online.

Pengujian aktivasi lokal:

```powershell
& 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe' tests\activation.php
```

Halaman yang masih menampilkan “Buat akun pertama” berarti akun aplikasi belum berhasil dibuat. Akun aplikasi terpisah dari akun hosting InfinityFree.

## Backup dan pemulihan

Ekspor database dari phpMyAdmin, serta unduh file unggahan dari `/htdocs/storage/uploads` melalui File Manager. Simpan backup konfigurasi database secara privat. Ekspor Excel hanya memuat data tabel dan tidak menggantikan backup database beserta file.

Rujukan resmi: [migrasi website ke InfinityFree](https://forum.infinityfree.com/t/how-to-migrate-your-website-to-infinityfree/49315) dan [keterbatasan koneksi MySQL dari luar hosting](https://forum.infinityfree.com/t/connecting-to-mysql-from-an-external-application/49339).
