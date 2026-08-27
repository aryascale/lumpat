# Lumpat - Race Timing & Event Management Platform

Lumpat adalah platform ekosistem digital terpadu untuk manajemen event olahraga, mulai dari registrasi peserta, manajemen tiket/racepack dengan QR Code, hingga akurasi live timing dengan hardware RFID sensor dan WebSocket broadcast.

---

## 🚀 Fitur Utama

- **Live Timing & Leaderboard**:
  - Live WebSocket broadcast untuk pergerakan pelari di setiap checkpoint / sensor.
  - EPC strict matching (Master, Start, Checkpoint, Finish).
  - Penghitungan otomatis Gun Time, Chip Time, Pace, Split Time, dan Peringkat Kategori/Gender.
  - Dynamic Real-time Patching tanpa reload halaman.
- **Event & Ticket Management**:
  - Pendaftaran event dengan form kustomisasi dinamis.
  - Integrasi pembayaran Midtrans (Webhook & Settle).
  - Verifikasi tiket dan sertifikat otomatis.
- **Checkpoint Staff Dashboard**:
  - Antarmuka khusus petugas checkpoint lapangan untuk pencatatan manual / verifikasi BIB.
- **Modern UI & Performance**:
  - Code-splitting modular per vendor (`react`, `antd`, `framer-motion`, `leaflet`).
  - Tiered HTTP Cache-Control (Immutable chunks, stale-while-revalidate untuk assets).
  - Background image preloading dan GPU-accelerated 3D circular gallery.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 6, TailwindCSS v4, Framer Motion, Ant Design, Leaflet, Lenis Scroll
- **Backend API**: Express 5, Node.js ESM, Socket.IO
- **Database & ORM**: MariaDB / MySQL, Prisma ORM
- **Automation / Tools**: Sharp (image processing), TSX, TypeScript

---

## 📦 Skrip & Perintah

| Perintah | Keterangan |
| :--- | :--- |
| `npm run dev` | Menjalankan Vite dev server (frontend saja) |
| `npm run server` | Menjalankan backend server Express & Socket.IO (`server.ts`) |
| `npm run dev:full` | Menjalankan frontend Vite dan backend server secara bersamaan |
| `npm run build` | Build bundle frontend untuk produksi |
| `npm run build:server` | Kompilasi TypeScript backend ke `dist-server` dan fix ESM imports |
| `npm run build:all` | Build menyeluruh (Frontend + Backend) |
| `npm run start` | Menjalankan backend server hasil build produksi |
| `npm run db:backup` | Backup database ke folder `backups/` |
| `npm run db:reset` | Reset database schema |

---

## 📂 Skrip Utilitas (`scripts/`)

- `scripts/fix-imports.mjs`: Mengonversi dan memperbaiki import path ESM pada folder `dist-server/`.
- `scripts/resize-hero-thumbnails.mjs`: Mengoptimasi thumbnail gambar hero landing page (WebP max 400px).
- `scripts/seed-admin.ts`: Inisialisasi akun administrator awal di database.
- `scripts/create-checkpoint-user.ts`: Membuat akun kredensial petugas checkpoint timing.
- `scripts/test-sensor.ts`: Simulator pengiriman payload RFID sensor ke endpoint `/api/sensor-record`.
- `scripts/deploy.sh` & `scripts/deploy-staging.sh`: Skrip otomatisasi deployment server.

---

## 📖 Dokumentasi Teknis Tambahan

- [LIVE-TIMING-DOCS.md](file:///c:/project/lumpat/LIVE-TIMING-DOCS.md): Spesifikasi lengkap API `/api/sensor-record` untuk integrasi hardware scanner RFID.
