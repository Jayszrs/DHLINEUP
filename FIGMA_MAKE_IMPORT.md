# Import ke Figma Make

File Figma Make tujuan:
https://www.figma.com/make/MXIvHddYY9xh2g0I8vuMrq

1. Ekstrak ZIP `DH_FleetSync_Source_Code.zip` ke folder lokal.
2. Buka Figma Make tujuan dan tampilkan Code / Files explorer.
3. Drag-and-drop **isi folder hasil ekstrak** ke file explorer Figma Make; dukungan drag file/folder ada di UI Figma Make.
4. Pastikan ada `package.json`, `index.html`, folder `src`, `public`, `.figma/make` (jika impor menerima folder tersembunyi), lalu buka Preview.
5. Jika Preview membutuhkan bantuan, beri prompt:
   "Gunakan file proyek React + TypeScript + Vite yang telah saya unggah sebagai source of truth. Jalankan preview; jangan mengganti desain DH FleetSync, jangan menghapus 53 entri dan 102 gambar bukti. Perbaiki hanya konfigurasi jika diperlukan. Jangan mengarang data Mine Dispatch atau FTW."

Alternatif: jalankan di VS Code dengan `npm install` dan `npm run dev`. Ekspor kode Make via menu File actions → Download code.

Penting: Make file sudah dibuat, tetapi unggah otomatis belum diselesaikan dari ChatGPT karena lingkungan unggah jaringan tidak tersedia. Panduan ini untuk menyelesaikan impor melalui UI.
