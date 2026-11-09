# DHOCC, 9 November 2026

Branding aktif memakai DHOCC dan simbol SVG transparan dengan gradasi emas ke oranye, sehingga tetap tajam pada ukuran besar dan layar rapat piksel. Lapisan foto login dikurangi dan bergeser ke oranye. Foto tambang asli tetap digunakan.

Dashboard memakai kartu status berwarna dan ring persentase berlabel. Daily, WTD (Senin sampai tanggal acuan), MTD, dan YTD speed dihitung dari penjumlahan catatan, catatan bergerak, dan jumlah speed pada filter terpilih. Acuan adalah tanggal data terakhir dalam filter. Tidak ada asumsi target produksi atau batas kecepatan. Periode kosong menampilkan N/A, bukan rata-rata nol.

Animasi WebGL menampilkan dump truck di lintasan dan operator berhelm. Kecepatan gerak truk mengikuti rata-rata bergerak terpilih. Visual bersifat ilustratif; posisi kendaraan bukan telemetri langsung. Tombol jeda, preferensi reduced motion, jeda ketika tab/visual tidak terlihat, serta fallback perangkat tanpa WebGL tersedia. Three.js disajikan dari aset lokal, hanya pada kedua dashboard.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2. Gradasi oranye mengikuti permintaan pengguna dan identitas DH. Tint KPI menyampaikan kategori; warna periode membedakan cakupan waktu. TT Firs Neue dari pengguna dipertahankan. Animasi hanya berada dalam satu panel untuk mendampingi angka tanpa menggerakkan tabel monitoring.

Sumber data tambahan: folder Drive `1Gzu4L_7gpsLlU5N8EJ07ag8W4_DgNpG0`, 265 XLSX. Semua file lokal diperiksa terhadap MD5 yang disediakan Google Drive. Impor dibatasi pada Creation Time WIB 17–31 Oktober 2026. Baris identik dihapus dari hitungan ganda. Empat pasangan dengan timestamp sama dan nilai berbeda dipertahankan seluruhnya: DT2912, DT2684, DT2675, DT1534. Tidak ada pemilihan salah satu nilai secara arbitrer.

Hasil verifikasi: 260 unit berdata, 3.228 rekap unit/hari, 4.956.152 pembacaan unik, 3.881.027 pembacaan bergerak, jumlah speed 69.447.290,99, maksimum 146,05 km/jam. Sumber memuat 4.982.392 baris; 26.240 baris identik tidak dihitung ganda. File DT3312, DT3241, DT4018, dan DT2992 tidak memuat pembacaan. File bernama DT4042.xlsx sebenarnya berisi Device Name DT4041; impor mengikuti identitas perangkat dalam data, bukan mengganti nama unit berdasarkan nama file. Tidak ada pembacaan di luar 17–31 Oktober. Empat file sampel diperiksa silang dengan parser MDVR aplikasi, termasuk format DT2376.

`backend/cli/import-speed-folder.js` memeriksa checksum dan menghitung ulang rekap dari arsip GPS. Tanpa `--apply`, perintah hanya memvalidasi. Mode apply menyimpan backup privat, mengunggah GPS ke bucket privat, lalu menambahkan rekap dan GPS dalam transaksi dengan pemeriksaan bahwa data lama belum berubah. Tanggal yang sudah ada dengan angka berbeda ditolak. Impor ulang revisi yang sama dilewati. Paket sumber, backup, dan hasil verifikasi berada di `.private`, tidak dimasukkan ke Git atau aset publik.

Proyek Vercel yang sama digunakan pada akun Academicrypto, dengan domain utama `dhocc.vercel.app`. Kredensial dan database tidak disalin ke akun Vercel lain.
