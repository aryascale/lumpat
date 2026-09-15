# Admin Platform Upgrade — Design

Date: 2026-09-01 · Branch: `layoutadmin` · Status: approved by owner

## Goal

Six upgrades to the lumpat admin platform: RBAC hardening, daisyUI foundation,
RPC participant scan with logging, downloadable e-ticket PDFs (name+email
lookup), a support-ticket report, and a first antd→daisyUI migration wave.

## Constraints (owner-mandated)

- Admin look & operator flow stay the same — the owner knows the current UI; only the code gets cleaner.
- `EventDetailPage.tsx` (19 tabs) is out of scope for this cycle.
- One intentional flow change: admin login switches from shared env credentials to real JWT accounts (@lumpat.co.id).

## Decisions

| Topic | Decision |
|---|---|
| Admin styling | Add daisyUI 5, replace antd gradually (coexistence during transition) |
| RPC scan | Verify registration + payment status AND persist scan log (race-pack tracking) |
| E-ticket | Real `.pdf` file client-side via jspdf + existing `qrcode` lib; lookup by name + email, no login |
| Ticketing report | = support tickets (`/admin/tickets`), add summary + filters + CSV export |

## Phase 1 — RBAC hardening + monitoring menu

1. `RoleGuard` (App.tsx): null user currently defaults to `super_admin` — replace with loading state during auth hydration, then redirect (login if unauthenticated, away if wrong role).
2. Legacy `/admin/home`, `/admin/create-event` routes bypass all guards — wrap in RoleGuard + AdminLayout.
3. `api/verify-participant.ts`: public (the emailed QR targets `/verify/:id` for anonymous scanners) but return limited fields (name, event, category, bib, status). PII (phone, blood type, emergency contacts) stays behind `requireRole`.
4. `api/registrations.ts` publicly dumps all participant PII — add `requireRole`; EventPage "Scan Peserta" button renders only for admin roles (event flag `enableRegisteredScan` remains the per-event toggle).
5. AdminLayout gate: remove `VITE_ADMIN_USER/PASS` + `localStorage["imr_admin_authed"]`; use AuthContext JWT session (`/api/auth-me`), redirect non-admins out.
6. `monitoring` added to super_admin menu allowlist; `api/monitoring.ts` cookie path accepts the 4 real admin roles (currently checks nonexistent literal `admin`).

## Phase 2 — daisyUI foundation

- `npm i -D daisyui@5`; `@plugin "daisyui"` in `src/styles.css`; custom theme derived from existing `:root` design tokens so admin colors don't shift.
- Shared primitives in `src/components/admin/ui/`: Button, Card, StatCard, PageHeader, DataTable, Modal, FilterBar (daisyUI idiom, cva + tailwind-merge already in deps).

## Phase 3 — RPC scan + ScanLog

- Prisma model `ScanLog`: id, registrationId, eventId, scannedBy (user email), bibNumber, result (valid/invalid/duplicate), source, createdAt. Follows existing migration pattern (`src/lib/migrations.ts` runtime migrations).
- `api/rpc-verify.ts` (requireRole super_admin/scan_admin/event_admin): resolve QR payload `/verify/<id>` or BIB number within event → registration + paymentStatus → insert ScanLog → respond with participant summary + last scan info.
- RpcPage: new registration-scan path showing registered/paid status and "already scanned X ago"; existing EPC scan path unchanged.

## Phase 4 — E-ticket PDF

- `api/my-tickets.ts`: GET `?email=&name=`, email validated like `checkout.ts`, only `paymentStatus='settlement'`, joins Event + Category, returns display fields only.
- New page `/tiket-saya` (public): name+email form → ticket cards (event, date, category, name, BIB, order id) → "Download PDF" → jspdf document with QR (`${BASE_URL}/verify/${id}`, client-rendered via `qrcode`).
- `/cek-tiket` stays support-ticket status check (fixed in Phase 5).

## Phase 5 — Support ticket report

- Create missing `api/tickets-status.ts` (`/cek-tiket` currently 404s): lookup SupportTicket by email + ticketNumber.
- `/admin/tickets`: summary cards (counts per status/category/priority), date + event filters, CSV export (client-side, pattern from PaymentsPage).

## Phase 6 — antd → daisyUI wave 1

- Migrate in order: AppSidebar/AdminLayout → OverviewPage → TicketsPage → PaymentsPage.
- Visual parity checked per page; antd remains installed for untouched pages (EventDetailPage et al.).

## Verification

Per phase: `npm run build` passes + manual smoke of affected routes; commit per phase.
