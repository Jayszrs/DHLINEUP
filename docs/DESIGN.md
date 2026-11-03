# Arah tampilan DH FleetSync

Referensi visual adalah source React pengguna di `legacy/react-source/src/App.tsx` dan `style.css`. Implementasi PHP mempertahankan sidebar, panel filter orange, tabel operasional, dashboard, dan galeri bukti.

- ENERGY 2: panel filter orange menjadi fokus utama saat mengolah Line Up.
- RHYTHM 1: layout konsisten untuk pekerjaan operasional berulang; dashboard membedakan ringkasan, tren, dan hasil pemeriksaan sesuai jenis data.
- MOTION 1: hover/focus serta buka/tutup menu dan dialog. Tidak ada animasi berjalan terus.
- Dasar navy dan teks terang berasal dari source. Orange adalah aksen identitas DH; merah, hijau, dan amber hanya untuk arti status.
- Gradien orange dibatasi pada panel filter, mengikuti identitas source dan memisahkan kontrol dari tabel.
- Font mengikuti fallback source, memakai TT Firs Neue bila tersedia lokal. Font berlisensi tidak didistribusikan.
- Logo, 102 bukti, dan tiga referensi berasal dari source; tidak ada gambar pengganti yang dibuat.
- Shadow menandai dialog/pemberitahuan di atas halaman. Radius membedakan panel, input, dan status.
- Form memakai label nyata, fokus terlihat, status berbentuk teks, dan dialog gambar dapat ditutup dengan Escape.
