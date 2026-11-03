# DH FleetSync: PHP + MySQL untuk Laragon 6

Source DH FleetSync sudah dikonversi menjadi aplikasi PHP native dengan frontend HTML/CSS dan JavaScript ringan. Data tersimpan di MySQL, termasuk perubahan dari form dan impor. Aplikasi aktif tidak memerlukan Node.js, npm, React, Composer, atau koneksi internet.

Sudah diuji menggunakan **PHP 8.1.10, MySQL 8.0.30, dan Apache 2.4.54** yang terpasang di `C:\laragon` pada laptop ini.

## Buka di laptop ini

1. Buka **Laragon 6**, pilih **Start All** agar Apache dan MySQL berjalan.
2. Buka [http://localhost/dhlineup/](http://localhost/dhlineup/).
3. Buat akun pengelola pada halaman pertama. Pilih username sendiri dan password minimal 10 karakter. Setelah setup, halaman ini otomatis ditutup dan pengguna harus login.

Database `dh_fleetsync` beserta **53 Line Up, 49 Master Operator, dan 102 gambar bukti** sudah disiapkan. Akun utama belum dibuat agar username dan password ditentukan sendiri.

Folder `C:\laragon\www\dhlineup` merupakan **junction** menuju folder project ini. Mengedit source di Downloads langsung memperbarui aplikasi Laragon. Jangan menghapus file melalui junction karena file aslinya juga akan terhapus.

## Instalasi ulang / laptop lain

1. Salin folder project ke lokasi yang diinginkan. Nyalakan MySQL dari Laragon.
2. Jalankan **`install.bat`**. Installer membuat database, tabel, dan data awal. Aman dijalankan ulang: tidak menghapus perubahan dan tidak mengembalikan data yang sudah dihapus.
3. Untuk akses Apache dari folder Downloads, jalankan:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\link-laragon.ps1
   ```

   Atau letakkan project langsung di `C:\laragon\www\dhlineup`.
4. Nyalakan Apache, buka `http://localhost/dhlineup/`, dan buat akun pertama.

Alternatif tanpa Apache: jalankan **`start.bat`**, lalu buka `http://localhost:8088`. MySQL Laragon tetap harus berjalan. Biarkan jendela server terbuka; Ctrl+C menghentikannya.

Jika perintah `php` di terminal mengarah ke PHP lain, pakai executable Laragon secara eksplisit:

```powershell
& 'C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe' backend\cli\install.php
```

## Struktur folder

```text
DHLINEUP/
  frontend/
    views/
      layout.php                 Sidebar dan kerangka halaman
      pages/                     Halaman, form, dan tabel PHP/HTML
    assets/
      css/source.css             Tema dari source asli
      css/app.css                Penyesuaian form dan responsivitas
      js/app.js                  Menu mobile, lightbox, konfirmasi, loading
      dh-logo.png
      evidence/                  102 bukti asli
      reference/                 3 gambar referensi
  backend/
    bootstrap.php                Autoload, sesi, dan konfigurasi
    helpers.php                  Escape HTML, URL, tanggal, CSRF
    config/app.php               Pengaturan koneksi
    config/local.example.php     Contoh pengaturan lokal
    src/Controller.php           Routing dan alur permintaan
    src/Repository.php           Query SQL dan audit perubahan
    src/Auth.php                 Setup, login, logout, batas percobaan
    src/Validation.php           Validasi input server
    src/Spreadsheet.php          Baca/tulis XLSX dan CSV
    src/Upload.php               Validasi dan penyimpanan gambar
    src/Files.php                Penyajian aset dan bukti
    cli/install.php              Installer database dan seed
  database/
    schema.sql                   Definisi tabel SQL
    seed/lineup.json             53 catatan dari source asli
  public/
    index.php                    Pintu masuk aplikasi
    .htaccess                    Aturan Apache dan batas unggah
    .user.ini                    Batas unggah PHP FastCGI
  storage/
    uploads/                     Gambar unggahan pengguna
    logs/                        Log kesalahan PHP
  tests/                         Tes dengan database sementara
  docs/                          Hasil pengujian dan screenshot
  legacy/react-source/           Source React asli sebagai referensi
  install.bat                    Instalasi database
  start.bat                      Server PHP pada port 8088
  link-laragon.ps1               Hubungkan project ke Laragon
```

Frontend menampilkan data dan formulir. Backend memvalidasi permintaan, menjalankan query, menyimpan file, serta mengatur sesi. File SQL dan data seed berada di `database/`. Direktori frontend, backend, storage, database, dan legacy tidak dapat diakses langsung melalui Apache.

Untuk virtual host sendiri, arahkan **DocumentRoot ke `public`**. Routing memakai query `index.php?page=...`, sehingga tidak membutuhkan URL rewrite.

## Koneksi database

Default Laragon: host `127.0.0.1`, port `3306`, database `dh_fleetsync`, username `root`, password kosong. Jika berbeda, salin `backend/config/local.example.php` menjadi `backend/config/local.php` lalu ubah nilainya. File lokal diabaikan Git.

Variabel lingkungan: `DH_DB_HOST`, `DH_DB_PORT`, `DH_DB_DATABASE`, `DH_DB_USERNAME`, dan `DH_DB_PASSWORD`. Nilainya mengungguli file lokal, terutama untuk pengujian dengan database terpisah.

Installer membutuhkan ekstensi PHP `pdo_mysql`, `mbstring`, `fileinfo`, `zip`, dan `simplexml`; semuanya tersedia pada PHP Laragon laptop ini. File `schema.sql` dapat diimpor melalui HeidiSQL, tetapi installer direkomendasikan karena sekaligus mengisi data awal.

## Fitur

- Login berbasis sesi, password hash, setup akun pertama hanya dari localhost, dan pembatasan percobaan login.
- Dashboard per district: total Line Up, Mine, FTW, Daily/WTD/MTD/YTD, tren delapan hari, dan prioritas pengecekan. Acuan periode memakai tanggal data terakhir pada district terpilih.
- Line Up: filter district/tanggal/shift/type, pencarian, detail, tambah, edit, dan hapus.
- Master Operator: pencarian, tambah, edit, hapus, serta ekspor Excel. Operator yang memiliki riwayat Line Up tidak dapat dihapus.
- Unggah PNG/JPG/WebP, maksimal 5 MB per gambar dan 24 megapiksel. Bukti hanya dapat dilihat setelah login.
- Galeri bukti/referensi dengan gambar besar dan dukungan Escape.
- Impor XLSX/CSV, template kosong, serta ekspor XLSX/CSV sesuai filter yang sudah diterapkan.
- Catatan perubahan: pengguna, waktu WIB, aksi, dan ID data.
- Pencegahan data tertimpa bila dua formulir mengedit versi catatan yang sama.

Master Operator mengikuti penugasan terbaru saat Line Up disimpan. Edit master tidak menulis ulang identitas pada riwayat Line Up. Menghapus Line Up tidak menghapus master atau gambar arsip. Gambar yang dilepas/diganti tetap diarsipkan di storage; backup perlu menyertakan folder tersebut.

## Aturan impor dan ekspor

- Kolom wajib: **Tanggal** dan **Kode Alat**. Unduh template dari halaman Impor untuk nama kolom lengkap.
- Tanggal: `YYYY-MM-DD`, `DD/MM/YYYY`, atau serial Excel. NIK diekspor sebagai teks XLSX agar nol di depan tidak hilang.
- Duplikat dikenali dari **site + tanggal + shift + unit + NIK**. Impor melewati duplikat dan tidak menimpa data lama.
- Maksimal 10 MB dan 5.000 baris per impor. Seluruh batch dibatalkan bila satu baris tidak valid.
- Status: `Ya`, `Tidak`, `Belum dicek`. Shift: `D`, `N`, `Belum ditentukan`. Type: `Production`, `Support`, `Belum diklasifikasi`.
- XLSX memilih sheet yang namanya memuat `line`, atau sheet pertama. Header dapat berada dalam 30 baris pertama.
- `.xls` lama harus disimpan ulang menjadi `.xlsx` melalui Excel. Gambar embedded, macro, format visual, dan formula tidak dikonversi menjadi fitur aplikasi.
- Bukti diunggah melalui Edit; ekspor tabel tidak menyertakan gambar binary. CSV menetralkan awalan formula. Gunakan XLSX bila NIK memiliki nol di depan karena Excel dapat menafsirkan tipe sel CSV sendiri.

## Data sumber dan batas integrasi

Data awal hanya berasal dari **BCP**. District lain kosong sampai ditambahkan. Shift dan klasifikasi Production/Support tidak ada pada source awal sehingga tidak ditebak. Mine Dispatch dan FTW diperiksa terpisah; screenshot tidak otomatis mengubah status menjadi Ya.

Aplikasi menyimpan data pada MySQL lokal. Tidak ada koneksi ke API Mine Dispatch, SSO, spreadsheet perusahaan, atau data browser React yang pernah diedit secara terpisah. Akun pertama memiliki akses ke semua fitur; manajemen role dan akun tambahan belum menjadi bagian aplikasi ini.

## Pengujian

Nyalakan MySQL, lalu:

```powershell
python tests\run.py
```

Tes memakai PHP Laragon dan database sementara `dh_fleetsync_test_<acak>`, lalu menghapus database uji. Database utama tidak digunakan. Opsi `--php` tersedia jika executable berbeda.

Lihat [laporan pengujian](docs/VERIFICATION.md), [desktop](docs/lineup-desktop.png), [dashboard](docs/dashboard-desktop.png), dan [ponsel](docs/lineup-mobile.png).

## Jika ada masalah

- **Database belum siap**: nyalakan MySQL, periksa koneksi, lalu jalankan `install.bat`.
- **Port 8088 dipakai**: gunakan Apache di `http://localhost/dhlineup/`, atau hentikan server PHP lama sebelum menjalankan `start.bat` lagi.
- **Gambar gagal diunggah**: pastikan maksimal 5 MB, format sesuai, dan `storage/uploads` dapat ditulis. Batas PHP sudah tersedia di `.htaccess`/`.user.ini`; restart Apache bila konfigurasi diubah.
- **Konflik versi**: buka ulang formulir untuk memakai data terbaru. Salin catatan yang belum tersimpan sebelum memuat ulang.
- **Error lain**: baca `storage/logs/php.log`.

Backup memakai ekspor database dari HeidiSQL atau mysqldump, ditambah `storage/uploads` dan aset bukti asli. Ekspor Excel saja tidak mencakup akun, audit, atau gambar unggahan.

Referensi implementasi PHP: [PDO prepared statements](https://www.php.net/manual/en/pdo.prepared-statements.php) dan [ZipArchive](https://www.php.net/manual/en/class.ziparchive.php).
