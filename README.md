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

- Banyak, tapi lupa apa aja

## Yang sengaja tidak dibuat

Backend, API, autentikasi, database, form edit master data (nama, HS code,
export/import value, patent, dsb.) — sesuai brief, semuanya mock/local state.

## Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 + `@xyflow/react` (React Flow)
+ Zustand. Tidak memakai ECharts — belum diperlukan untuk mini-visualization
di detail panel versi ini.
