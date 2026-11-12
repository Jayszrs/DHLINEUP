# Integrasi aset V3 — OCC JHO dan fleet

Paket pengguna `DHLINEUP_3D_CODEX_V3` telah diintegrasikan ke aplikasi produksi `node-app/`, memakai viewer, preview, data unit dan pipeline aset yang sudah ada. Tidak ada aplikasi React/Vite terpisah.

## Susunan yang berlaku

Mengikuti permintaan terbaru dan **angka merah pada screenshot**, bukan susunan lama tujuh meja:

| Nomor | Nama | NIK | Peran | Posisi dari arah pintu menuju layar |
| --- | --- | --- | --- | --- |
| 1 | Fassel Praditya | M10111 | Internship OCC | Belakang, kiri pertama |
| 2 | Yasmine Pratiwi | M10112 | Internship OCC | Belakang, kedua |
| 3 | Shafira Fauzia Dahlan | M10071 | Internship PMO | Belakang, ketiga |
| 4 | Marchyla Ageng Pangesti | M10072 | Internship PMO | Belakang, kanan keempat |
| 5 | Gregorio Josh Immanuel | M10103 | Internship IT | Depan dekat meja rapat, kiri |
| 6 | Jaelani Surya Saputra | M10102 | Internship IT | Depan dekat meja rapat, kanan |

Dua meja depan dekat meja rapat; empat meja belakang dekat pintu. Keenam orang menghadap PC. JHO tanpa helm; tiga variasi perempuan dan tiga laki-laki mengikuti konfirmasi pengguna. Klik tetap membuka identitas, status, bio dan foto asli bila tersedia. Jumlah furnitur ilustratif tidak mengubah delapan perangkat workstation di master sumber.

## Aset dan interaksi

- `node-app/frontend/assets/js/dh3d/dh-premium-models.js`: sumber prosedural dari paket, disesuaikan untuk duduk, berjalan, pose driver dan pemisahan rig kepala/mata/lengan/kaki. Seragam biru turquoise reflektif, sepatu bertali; driver memakai helm putih. Pekerja laki-laki memakai radio/pose lengan silang, perempuan memegang tablet pada pratinjau pekerja tambang.
- `node-app/frontend/assets/js/fleet-models.js`: adapter berbagi geometri/material, penggabungan permukaan statis, empat roda dengan pivot mandiri, serta nomor DT dinamis di canopy, grille dan kedua sisi. Unit tidak valid menghasilkan model tanpa identitas, bukan fallback DT2917. Permukaan dua sisi bak dipertahankan saat dioptimalkan.
- Model dipakai oleh ruangan JHO, DH Line Up, preview DT recap speed dan atlas ikon peta yang sudah ada. Preview tetap mendukung rotasi, zoom dan fullscreen. Tidak ada tombol jeda animasi.
- Jadwal kerja/istirahat/meeting, cahaya pagi–malam, PC menyala/mati, zoom mouse/trackpad, reduced motion dan penghentian render saat tidak terlihat dipertahankan. Render dibatasi 30 fps dan jumlah pixel; clone berbagi buffer. Gambar referensi tidak dimuat pada dashboard biasa.
- `dh-premium-viewer.js` dan `dh-premium-3d.css`: halaman review aset yang memakai factory teroptimasi yang sama. Buka `/3d-preview` setelah login; `/dh-3d-preview.html` mengarah ke halaman tersebut. Nomor DT2917 pada demo diberi label contoh, bukan data GPS. Gambar referensi ada di bagian yang dapat dibuka; kiriman PNG dan hero WebP asli tetap utuh, design sheet juga tersedia sebagai WebP yang lebih ringan.

## Batas visual

Gambar hero yang disediakan adalah gambar CGI statis; model yang dapat diputar merupakan geometri prosedural yang diadaptasi dari sumber paket, **bukan rekonstruksi CGI 1:1, CAD resmi atau model wajah orang asli**. Tidak ada file GLB dari paket ini. Foto profil, data Supabase, source spreadsheet, speed/GPS, auth, role, impor/ekspor dan skema database tidak diubah oleh revisi ini.

Bandingkan hasil depan, samping dan belakang dengan referensi:

- [Karakter: referensi dan tiga sudut model](workers-comparison.webp)
- [Dump truck: referensi dan tiga sudut model](truck-comparison.webp)
- [Prompt yang disesuaikan dengan revisi terbaru](CODEX_PROMPT.md)
- [README asli paket](SOURCE_README.md)

## Verifikasi

Dari `node-app/`: `npm ci`, `npm run build`, `npm test`.

Hasil 12 November 2026: **112 tes lulus**; 11 tes khusus model/profil juga lulus setelah penyesuaian urutan screenshot. Pemeriksaan Chromium pada desktop dan ponsel 390 px: tanpa error JavaScript dan tanpa overflow; keenam profil, zoom mouse/Ctrl-wheel, nomor DT berbeda, mode terang/gelap dan tiga sudut model diperiksa. Simulasi istirahat/meeting tetap menggerakkan enam orang. Hash hero PNG/WebP dan design sheet PNG sama dengan kiriman asli. Halaman review juga diuji tetap memerlukan login.
