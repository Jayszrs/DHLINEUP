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

Data operasional lokal sudah diunggah ke versi online pada 3 November 2026:

- **53 Line Up** beserta nama/NIK operator, status, catatan, dan referensi bukti.
- **49 Master Operator**.
- **54 catatan riwayat lokal**, ditandai `local_laragon` untuk membedakannya dari aktivitas online.
- **102 gambar bukti** FTW/Mine Dispatch dan **3 gambar referensi**.

Akun dan password online tetap dipertahankan. Akun/password lokal, konfigurasi lokal, dan pembatasan login tidak diimpor. Database online berisi 55 riwayat setelah migrasi, termasuk satu aktivitas setup online yang sudah ada sebelumnya. Tidak ada gambar unggahan tambahan di `storage/uploads` lokal saat snapshot dibuat.

Backup database lokal, backup online sebelum impor, SQL migrasi, paket gambar, dan manifest tersedia secara privat di `dist/infinityfree/local-data-cda04e85ae77/`. Folder `dist` diabaikan Git dan diblokir dari akses Apache.

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
- Enam tabel tersedia; data online sudah berisi 53 Line Up dan 49 Master Operator.
- Paket aplikasi berhasil diunggah dan diekstrak ke `/htdocs`.
- Konfigurasi database aktif disimpan lewat editor File Manager, tanpa mencetak password ke output.
- Website menampilkan dashboard FleetSync melalui HTTPS dengan 53 Line Up, 12 Mine berstatus Ya, 41 Mine berstatus Tidak, dan 0 FTW berstatus Ya, sesuai snapshot lokal.
- Permintaan langsung ke `/backend/config/local.php` ditolak dengan halaman 403.
- Akses HTTP dialihkan ke HTTPS.
- 62 tes integrasi lokal dan sembilan tes aktivasi/deployment lulus. Pengujian lokal memakai database sementara, bukan database online.
- Migrasi data lulus 10 pemeriksaan pada database sementara: jumlah data, akun online tetap, impor ulang tanpa duplikat, perubahan online tidak tertimpa, serta checksum seluruh gambar dalam paket lokal.
- phpMyAdmin melaporkan impor data berhasil, **162 query** selesai. Riwayat online menampilkan 55 baris aktivitas.
- Galeri menampilkan **102 gambar bukti** dan tiga referensi, melalui route aplikasi yang memerlukan login.

## Mengemas ulang data lokal

```powershell
& 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe' backend\cli\export-local-data.php
& 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe' tests\data-migration.php
```

Paket data dipisahkan dari paket aplikasi. `local-images.zip` diekstrak ke `/htdocs`, sedangkan `local-data.sql` diimpor ke database melalui phpMyAdmin. Jangan upload file SQL atau backup ke direktori publik. SQL migrasi menambahkan data dan melewati identitas yang sudah ada, tanpa menghapus data online. Snapshot yang sama diberi penanda agar impor ulang tidak menggandakan riwayat.

Pengujian aktivasi lokal:

```powershell
& 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe' tests\activation.php
```

Halaman yang masih menampilkan “Buat akun pertama” berarti akun aplikasi belum berhasil dibuat. Akun aplikasi terpisah dari akun hosting InfinityFree.

## Backup dan pemulihan

Ekspor database dari phpMyAdmin, serta unduh file unggahan dari `/htdocs/storage/uploads` melalui File Manager. Simpan backup konfigurasi database secara privat. Ekspor Excel hanya memuat data tabel dan tidak menggantikan backup database beserta file.

Rujukan resmi: [migrasi website ke InfinityFree](https://forum.infinityfree.com/t/how-to-migrate-your-website-to-infinityfree/49315) dan [keterbatasan koneksi MySQL dari luar hosting](https://forum.infinityfree.com/t/connecting-to-mysql-from-an-external-application/49339).
