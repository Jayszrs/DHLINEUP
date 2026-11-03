# Verifikasi DH FleetSync

Tanggal: 3 November 2026, WIB. Runtime: PHP 8.1.10, MySQL 8.0.30, Apache 2.4.54 bawaan Laragon pada laptop ini.

## Backend dan database

**PASS: 62 pemeriksaan integrasi**, dijalankan dengan `python tests/run.py`. Setiap run menggunakan database baru `dh_fleetsync_test_<acak>` yang dibersihkan setelah selesai.

- Installer dapat dijalankan ulang tanpa reset atau mengembalikan catatan sumber yang sudah dihapus.
- 53 catatan sumber, 49 identitas operator, dan 102 referensi gambar dipertahankan.
- Setup pertama, penutupan setup, login/logout, autentikasi bukti, CSRF, serta kunci login setelah lima kegagalan.
- Seluruh halaman utama, detail, filter kosong, tanggal tidak valid, dan pencarian berisi SQL diuji.
- Tambah/edit/hapus Line Up dan Master Operator; perlindungan operator yang memiliki riwayat.
- Data bertahan setelah reload dan dapat dibaca dari sesi browser lain.
- Konflik versi menolak formulir lama tanpa menimpa data terbaru; data duplikat ditolak.
- Bukti gambar asli dan unggahan dapat dibaca kembali; file PHP yang menyamar sebagai gambar ditolak.
- HTML pengguna di-escape; path traversal aset ditolak; GET tidak dapat menjalankan hapus.
- XLSX asli berupa paket ZIP/XML, mempertahankan NIK teks, serta dapat diekspor lalu diimpor kembali tanpa menduplikasi catatan.
- Pembacaan shared strings dan tanggal serial Excel dengan sistem tahun 1904 diuji.
- Impor CSV menyimpan status, shift, type, serta nol di depan NIK; duplikat di dalam file dilewati.
- Site/shift/type kosong pada template memakai default yang didokumentasikan.
- Impor dengan baris tidak valid dibatalkan seluruhnya; format XLS lama memberi pesan konversi; XML dengan external entity ditolak.
- Aktivitas perubahan masuk ke tabel audit.

## Browser

Playwright digunakan untuk memeriksa interaksi pada database uji terpisah, tanpa membuat akun pada database utama.

- **PASS**: setup akun uji, filter district, pencarian, Show, Reset, dan empty state.
- **PASS**: unduhan XLSX/CSV, pembukaan bukti, tombol Tutup, dan Escape.
- **PASS**: input/edit/hapus Line Up melalui form dan konfirmasi browser; hasil hapus diverifikasi lewat pencarian.
- **PASS**: tambah/edit Master Operator melalui form.
- **PASS**: pilih file CSV dan submit impor melalui browser; notifikasi sukses dan catatan hasil impor diverifikasi.
- **PASS**: Dashboard, Master Operator, Dokumentasi, Riwayat Perubahan, form, dan halaman impor terbuka.
- **PASS**: tidak ada overflow horizontal pada dokumen di lebar 320, 390, 768, dan 1440 piksel. Pada 390 px, sembilan halaman diperiksa. Tabel lebar sengaja menggunakan scroll di dalam container.
- **PASS**: menu mobile dapat dibuka dan ditutup memakai Escape. Sidebar tertutup diberi `inert` agar kontrol di luar layar tidak menerima fokus; pada desktop navigasi kembali aktif.
- **PASS**: console browser tidak menunjukkan error/warning pada pemeriksaan.

Screenshot hasil pemeriksaan:

- [Line Up desktop](lineup-desktop.png)
- [Dashboard desktop](dashboard-desktop.png)
- [Line Up ponsel](lineup-mobile.png)

## Apache Laragon

- **PASS**: `http://localhost/dhlineup/` mengarah ke halaman setup dengan HTTP 200.
- **PASS**: permintaan langsung ke `backend/config/app.php`, `database/schema.sql`, dan `.git/config` menghasilkan HTTP 403.
- **PASS**: junction `C:\laragon\www\dhlineup` menunjuk ke folder project, tanpa menyalin atau mengubah project lain.

## Pemeriksaan kualitas tampilan

- **Hard Gate PASS**: data tampilan berasal dari source/database; filter, form, ekspor, dan dialog bekerja. Error, loading penyimpanan, serta empty state tersedia. Fokus terlihat dan gambar memiliki alt. Pemeriksaan kontras teks dengan background solid pada delapan halaman tidak menemukan rasio di bawah 4.5:1 untuk teks biasa atau 3:1 untuk teks besar; pemeriksaan ini bukan sertifikasi aksesibilitas menyeluruh.
- **Purpose Gate PASS**: navy/orange, gradien panel filter, tipografi, radius, dan komposisi mengikuti source DH FleetSync dengan alasan pada [DESIGN.md](DESIGN.md). Tidak ada aset, testimoni, atau angka pelanggan yang dibuat.
- **Liveliness PASS**: ENERGY 2 / RHYTHM 1 / MOTION 1. Panel filter adalah fokus Line Up; urutan ringkasan/tren/hasil pemeriksaan mengikuti keputusan operasional, dan interaksi tidak memakai animasi berulang.
- **Craftsmanship PASS**: lint PHP, sintaks JavaScript, 62 pemeriksaan integrasi, interaksi browser, dan pemeriksaan responsif lulus. Tidak ada langkah build frontend yang diperlukan.

## Batas hasil

Ini aplikasi lokal PHP/MySQL. Pengujian tidak mencakup API perusahaan, SSO, penerapan internet publik, banyak pengguna bersamaan dalam jumlah besar, atau browser selain runtime Playwright yang tersedia. Akun utama tetap kosong untuk dibuat pengguna. Format XLS, gambar embedded Excel, serta manajemen role/akun tambahan tidak termasuk fitur aktif.
