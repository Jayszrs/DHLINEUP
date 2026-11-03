# DH FleetSync — Line Up Operator

Aplikasi React + TypeScript + Vite berdasarkan desain DH FleetSync di Figma.

Figma Design: https://www.figma.com/design/ORckjxqNE7ru6gZEYS0CVx?node-id=155-2

## Cara menjalankan (VS Code)

Memerlukan Node.js 20.19+ atau 22+.

```bash
npm install
npm run dev
```

Buka alamat localhost yang muncul (umumnya `http://localhost:5173`). Untuk build:

```bash
npm run build
npm run preview
```

## Fitur

- Dashboard: KPI dari spreadsheet, statistik Daily/WTD/MTD/YTD, dan tren 8 hari.
- Line Up: District, tanggal (kalender), Shift, Type Production/Support, Show, Reset, cari, 53 entri asli, detail, tambah/edit/hapus, ekspor Excel, impor XLSX/CSV.
- Master Operator: 49 NIK unik awal, cari, tambah/edit, export Excel.
- Dokumentasi: galeri bukti 102 gambar FTW/Mine Dispatch asli + 3 contoh tab 27; dapat diperbesar.
- Detail unit: NIK, jenis alat, status sumber, bukti, catatan, edit.
- Data baru/edit/impor tersimpan di browser lokal (localStorage), belum di server.

## Kejujuran data

- Semua entri awal berasal dari site BCP; ACP/KCP/SSCP kosong hingga dimasukkan.
- Kategori **Production/Support** dan Shift **D/N** tidak ada pada sheet sumber. Awalnya `Belum diklasifikasi` dan `Belum ditentukan`; isi secara manual atau dari data resmi.
- Mine Dispatch dan FTW adalah pemeriksaan terpisah. Bukti screenshot tidak otomatis berarti FTW sudah terisi. Status verifikasi spreadsheet sumber dipertahankan, tetapi status aplikasi dihitung konservatif.
- Impor Excel menambahkan baris data, tidak mengekstrak gambar embedded. Unggah gambar pada form Edit.
- Tidak ada sinkronisasi API maupun login perusahaan. Untuk produksi, perlu backend, autentikasi, izin akses, dan audit log.
- File font TT Firs Neue tidak disertakan dalam ZIP (hak distribusi font). CSS akan memakai font lokal jika ada, dengan fallback system sans.

## Struktur proyek

```text
src/
  App.tsx                  UI dan interaksi
  style.css                Tema DH
  types.ts                 Tipe data
  data/lineup.json         53 entri awal
  lib/data.ts              Persistensi dan utilitas
  lib/export.ts            Impor/ekspor Excel
public/assets/
  dh-logo.png              Logo DH
  evidence/                Bukti FTW/Mine
  reference/               Contoh gambar tab 27
.figma/make/                Konfigurasi runtime Make
```
