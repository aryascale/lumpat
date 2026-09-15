# Local Dev Setup

Cara jalanin project lumpat secara lokal lengkap dengan seed data + smoke test.

## 1. Setup sekali

```bash
cp .env.example .env        # atau pakai .env yang sudah ada
npm install
npm run docker:dev          # MySQL (3306) + phpMyAdmin (8090) + app (4069) di Docker
```

Tunggu MySQL sehat (~20 detik), lalu buat schema & seed:

```bash
npm run prisma:push         # buat tabel dari prisma/schema.prisma
npm run seed:dev            # isi data test (idempotent, aman diulang)
```

## 2. Jalanin harian (hot reload)

```bash
npm run dev:full            # vite (5173) + server API (3069)
```

Buka http://localhost:5173. Server API juga bisa diakses langsung di :3069.

Alternatif full-docker (build production): `npm run docker:dev` lalu buka http://localhost:4069.
phpMyAdmin: http://localhost:8090 (root / lumpat2026).

## 3. Test

```bash
npm run smoke               # 24 asersi end-to-end (server harus jalan)
```

Menguji: login JWT tiap role, RBAC (anon 401, role salah 403), my-tickets hanya lunas,
verify publik tanpa PII, rpc-verify + ScanLog duplikat, monitoring, admin tickets/payments.

## Akun test (dari seeder)

| Email | Password | Role |
|---|---|---|
| super_admin@lumpat.co.id | Admin123! | super_admin (semua menu + monitoring + users) |
| event_admin@lumpat.co.id | Event123! | event_admin |
| scan_admin@lumpat.co.id | Scan123! | scan_admin (rpc + tickets) |
| payment_admin@lumpat.co.id | Payment123! | payment_admin (payments) |
| user@example.com | User123! | user biasa (tanpa akses admin) |

## Data test

- Event **Lumpat Fun Run 2026** (slug `lumpat-fun-run-2026`), kategori 5K (150k) & 21K (350k)
- Registrasi: Budi Santoso (lunas, BIB 1001), Sari Dewi (lunas, BIB 1002), Joko Pending (belum bayar)
- Support ticket: LMPT-202609-DEV1 (open/high), DEV2 (in_progress), DEV3 (resolved)

## Halaman yang bisa dicoba

- `/admin` — login JWT, menu per role (Monitoring cuma super_admin)
- `/monitoring` — dashboard server (super_admin)
- `/tiket-saya` — input `budi@example.com` → download e-ticket PDF + QR
- `/cek-tiket` — `budi@example.com` + `LMPT-202609-DEV1`
- `/rpc/lumpat-fun-run-2026` — scan QR e-ticket atau ketik `1001` (login scan_admin)
- `/event/lumpat-fun-run-2026` — halaman publik event
