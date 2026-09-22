# Pohon Industri — Editor (Prototype)

Frontend-only prototype of a node/graph editor for menyusun pohon industri,
mirip Satisfactory Modeler tapi untuk data industri (raw material → intermediate
→ finished product → application), dikelompokkan per stage horizontal S0–S10.

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

Build produksi (opsional, untuk sanity-check):

```bash
npm run build
npm run preview
```

## Yang sudah berfungsi

- Master node catalog hardcoded & read-only (`src/data/masterCatalog.ts`)
- Tree state terpisah dari master data — node di canvas hanya menyimpan
  `masterNodeId`, `stageId`, `position`, dan `editorState` (priority/status)
- **+ Pohon Baru**: buat pohon baru (Empty / Example Nickel / Example Iron-Steel)
- **+ Tambah Simpul**: cari & tambahkan node dari katalog (by nama/HS code,
  filter by node type) ke stage yang sedang aktif
- Drag node (vertikal dalam kolom stage-nya), klik untuk select, double-click
  untuk buka detail drawer, klik kanan untuk context menu (Lihat Detail,
  Connect From, Duplicate, Change Stage, Remove from Tree)
- **Connect**: drag dari handle node, atau toggle mode "Connect" lalu klik
  source → target → muncul dialog pilih relation type
- Edge: klik untuk select, "Hapus Relasi" di toolbar untuk hapus, double-click
  untuk lihat detail relationship
- Stage: tambah/hapus/ubah nama/geser urutan, kode S0..S10 otomatis mengikuti
  urutan
- Node detail drawer: semua field master data read-only; hanya Priority,
  Status, dan Stage yang bisa diubah (editor state per-tree, tidak mengubah
  master catalog)
- Validasi topologi otomatis: self-loop, circular dependency (dengan jalur
  siklus), edge menggantung, node tanpa outgoing relation / node terisolasi
- Undo/redo untuk semua aksi yang mengubah tree state
- Simpan Draft (localStorage) / Batalkan Perubahan (reload draft tersimpan) /
  Publish (mock status, toast konfirmasi)
- Minimap, zoom in/out/fit, pan — semua dari React Flow

## Yang sengaja tidak dibuat

Backend, API, autentikasi, database, form edit master data (nama, HS code,
export/import value, patent, dsb.) — sesuai brief, semuanya mock/local state.

## Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 + `@xyflow/react` (React Flow)
+ Zustand. Tidak memakai ECharts — belum diperlukan untuk mini-visualization
di detail panel versi ini.
