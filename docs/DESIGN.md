# Arah tampilan DH Line Up

- Profil akun menampilkan foto di sebelah identitas pada desktop dan di atas identitas pada ponsel. Nama lengkap, username, NIK, dan site disimpan per akun. Foto memiliki preview, pembesaran, batal pilihan, serta hapus saat menyimpan. Tanpa foto, gunakan inisial. Foto tersimpan menggantikan inisial pada menu akun; mode terang/gelap mengikuti token yang sama. NIK/site yang belum diketahui dibiarkan kosong, tidak diisi dari data Operator.

- Form penugasan memakai tiga pilihan yang dapat dicari: Nomor unit, Jenis alat, dan Tipe alat. Daftar DT berasal dari tab Daftar Unit pada spreadsheet pengguna (178 unit, 4 November 2026), digabung dengan unit yang sudah tersimpan. Model lama tetap menjadi Tipe alat; kategori disimpan terpisah. Dropdown mendukung tombol panah/Enter/Escape, pencarian teks, dan tombol menambah jenis/tipe di bagian bawah daftar. Opsi baru tersimpan untuk seluruh akun; akses perubahan tetap mengikuti izin data.

Antarmuka operasional untuk memeriksa penugasan, Mine Dispatch, dan FTW. Penyempurnaan mengikuti permintaan pengguna: putih terang, mode gelap pilihan, navigasi hamburger, dan kontrol akun yang jelas.

- ENERGY 2, RHYTHM 1, MOTION 1: kepadatan tabel terjaga, susunan konsisten, gerak terbatas pada interaksi.
- Putih sebagai permukaan utama dengan latar abu dingin. Mode gelap memakai navy dan kontras teks setara.
- Oranye DH untuk aksi utama dan navigasi aktif. Hijau, merah, amber menyampaikan status melalui teks sekaligus warna.
- TT Firs Neue Bold berasal dari file pengguna `TTFirsNeue-Bd(1).ttf`, disimpan sebagai aset lokal untuk judul, tombol, dan penekanan. Isi tabel/form memakai Segoe UI regular karena hanya bobot Bold yang diberikan.
- Sidebar dapat ditutup di desktop dan menjadi drawer di ponsel. Pilihan tema dan sidebar desktop tersimpan di perangkat.
- Menu nama akun berisi edit profil, ganti password, kelola akun, dan keluar. Administrator dan tiga akun yang diberi izin dapat mengubah data; Pengelola lainnya melihat/mengekspor data. Semua akun tetap dapat membuat akun Pengelola tanpa memberi izin edit data. Administrator dapat mengubah profil/role dan mereset password akun lain. Lupa password sementara memakai bantuan administrator.
- Tabel Kelola Akun memakai lebar halaman agar role tidak terpotong. Administrator mendapat aksi Edit profil & role serta Reset password per akun; formulir pembuatan akun berada di bawah tabel. Tabel dapat digulir pada layar sempit. Role yang tersedia adalah Pengelola dan Administrator; administrator terakhir tetap dipertahankan.
- Tabel memiliki header tetap dan scroll sendiri; halaman tetap dapat dipakai di layar sempit.
- Logo dan bukti asli dipertahankan. Tidak ada angka dashboard atau gambar bukti yang dibuat.
- Fokus terlihat, input berlabel, menu mendukung keyboard, dan notifikasi menyampaikan hasil penyimpanan.
- Nama/unit Line Up merupakan tautan asli ke detail, dan nama Operator membuka profil. Tombol Edit/Hapus terlihat pada setiap baris bagi akun berizin; akses baca tidak menampilkan aksi perubahan. Label navigasi memakai Operator.
- Simbol DH transparan dari referensi pengguna dipertahankan oranye; tulisan DH terpisah berwarna hitam pada tema terang dan putih pada tema gelap. Sidebar tidak lagi menaruh logo pada kotak navy tetap. Favicon menggunakan simbol tanpa tulisan.
- Form Line Up mengelompokkan tiga status pengecekan dalam satu baris, diikuti bukti FTW/Mine dua kolom (satu kolom di ponsel). Status Sumber/Catatan tidak ditampilkan. Pilihan gambar langsung mendapat preview yang dapat diperbesar, nama/ukuran file dan status belum disimpan; batal pilihan memulihkan bukti lama tanpa menghapusnya.

- Halaman masuk dan pemulihan password memakai foto tambang pengguna dengan truk XCMG dan pekerja DH di kiri (54%) serta formulir putih di kanan (46%). Lapisan hitam dan amber pada foto menjaga keterbacaan tulisan putih dan nuansa oranye DH. Pada layar sampai 700px, foto menjadi header pendek di atas formulir putih; judul dan tombol tetap memakai TT Firs Neue Bold, isi memakai Segoe UI.
- Filter District, Tanggal, Shift, dan Jenis pada Line Up langsung mengirim formulir GET setelah pilihan berubah. Pertahankan kontrol berlabel dan tombol Tampilkan agar pengguna tetap dapat menerapkan filter secara manual; pencarian teks memakai tombol Cari atau Enter. Hasil kosong tetap menampilkan arahan mengubah atau mereset filter.
