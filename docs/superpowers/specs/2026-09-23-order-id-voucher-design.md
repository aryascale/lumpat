# Design: Order ID Scheme (LMPT-SKU) + Voucher System

Date: 2026-09-23
Status: Approved in chat, pending implementation

## Overview

Two related features for lumpat.co.id:

1. **New order ID scheme** — human-readable payment IDs following
   `LMPT-{CATEGORY}-{HHMMDDMMYYYY}-{5 random digits}`.
2. **Voucher system** — admin creates vouchers (code, discount, quota, optional
   event scope, validity window); users apply a code at checkout; usage history
   is recorded per redemption.

## Part A: Order ID Scheme

### Format

```
LMPT-{CATEGORY}-{HHMMDDMMYYYY}-{NNNNN}
LMPT-10KTNIPOLRI-165822092026-12345
```

| Segment   | Rule |
| --------- | ---- |
| `LMPT`    | Fixed prefix (user decision; supersedes legacy `LMPAT-` prefix. Existing rows are untouched — orderId is a plain string). |
| `CATEGORY` | Slug of category name: uppercase, strip non-alphanumerics, max 12 chars. Fallback `EVENT` if empty. |
| Timestamp | WIB (Asia/Jakarta, UTC+7). `HHMM` + `DDMMYYYY`, 12 digits, no separators. **No colon** — Midtrans order_id only allows alphanumerics, `-`, `_`, `.`. |
| Random    | 5 digits (0-9). |

Max length ≈ 36 chars — under Midtrans's 50-char limit.

### Generation

- New helper `src/lib/order-id.ts` with `generateOrderId(categoryName: string, now = new Date()): Promise<string>`.
- WIB formatting via `Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ... })` — never manual offset math.
- Collision handling: after generating, `SELECT 1 FROM EventRegistration WHERE orderId = ? LIMIT 1`; retry up to 3 times with fresh random. (A DB unique constraint is impossible: bulk checkout inserts multiple registration rows sharing one orderId.)
- Called once per checkout in `api/checkout.ts` (replaces current `LMPAT-${Date.now()}-${hex}` line, checkout.ts:172).

## Part B: Voucher System

### Data model (Prisma)

```prisma
model Voucher {
  id           String              @id @default(uuid())
  code         String              @unique // stored uppercase
  discountType String              // "nominal" | "percent"
  value        Int                 // Rp for nominal, 1-100 for percent
  maxDiscount  Int?                // Rp cap for percent, null = uncapped
  quota        Int                 @default(0) // 0 = unlimited (matches Category.quota semantics)
  usedCount    Int                 @default(0)
  eventId      String?             // null = all events
  validFrom    DateTime?
  validUntil   DateTime?
  isActive     Boolean             @default(true)
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  redemptions  VoucherRedemption[]
}

model VoucherRedemption {
  id             String   @id @default(uuid())
  voucherId      String
  orderId        String   @unique // idempotency: 1 redemption per order
  email          String
  name           String // snapshot of purchaser at settlement time
  eventId        String
  discountAmount Int // snapshot, Rp actually applied
  createdAt      DateTime @default(now())
  voucher        Voucher @relation(fields: [voucherId], references: [id])

  @@index([voucherId])
  @@index([email])
}
```

`EventRegistration` gains two columns (backwards compatible):
- `voucherCode String?`
- `discountAmount Int @default(0)`

Migration: update `prisma/schema.prisma`, then `prisma db push` (repo convention — only one manual migration folder exists, dev flow uses db push).

### Discount calculation

`src/lib/voucher.ts` — `calculateDiscount(v, totalGrossAmount): number`

- nominal: `min(value, total)`
- percent: `floor(total * value / 100)`, then `min(result, maxDiscount)` when `maxDiscount` set, then `min(result, total)`
- Always clamped to `[0, total]`.

### Validation rules (single source: `src/lib/voucher.ts` `validateVoucher`)

A voucher is usable when ALL hold:
- exists, `isActive`, code matched case-insensitively (stored uppercase)
- now within `[validFrom, validUntil]` (null bounds = unbounded)
- `eventId` null or equals the checkout's eventId
- quota unlimited (0) or `usedCount < quota`
- **max 1 redemption per email per voucher** (default decision): no existing `VoucherRedemption` for `(voucherId, email)`
- order total > 0 (vouchers are ignored on free events)

### Checkout flow (user side)

1. Checkout form (`src/pages/EventPage.tsx`) gains an optional "Kode Voucher" input with an "apply" action.
2. `POST /api/voucher/validate` `{ code, eventId, totalAmount }` → `{ valid, discountAmount, finalAmount, reason? }` — used for instant preview before paying. No auth (public, same as checkout).
3. `POST /api/checkout` accepts optional `voucherCode`. The server **re-validates** (never trusts the preview) and:
   - writes `voucherCode` + `discountAmount` onto each inserted `EventRegistration` row
   - computes `finalAmount = totalGrossAmount - discount`
   - sends `gross_amount = finalAmount` to Midtrans; `item_details` prices are reduced proportionally so the sum matches (Midtrans rejects mismatched/negative item prices)
   - if `finalAmount === 0` → free path (immediate settlement)
   - `logActivity('voucher.applied', ...)` with code + discount

### Settlement (quota decrement)

New helper `src/lib/voucher.ts` → `settleVoucherRedemption(orderId: string)`:
- fetch registrations for orderId; if any has `voucherCode`, look the voucher up
- `INSERT` into `VoucherRedemption` (unique orderId makes it idempotent — rely on insert-then-ignore-duplicate, no pre-SELECT race check) with `name`/`email` from the primary registration
- `UPDATE Voucher SET usedCount = usedCount + 1`
- ponytail: quota is re-checked at settlement but a concurrent race can overshoot quota by 1-2; acceptable for event-scale volume, upgrade to a transaction with `WHERE usedCount < quota` if it ever matters

Called from every place that sets `paymentStatus = 'settlement'`:
- `api/webhook-midtrans.ts`
- `api/check-payment-status.ts`
- `api/admin-settle-payment.ts`
- free path in `api/checkout.ts`

Failed/expired/deleted payments never decrement — redemption only exists for settled orders.

### Admin UI

- Route `/admin/vouchers` → `src/components/admin/pages/VouchersPage.tsx`, registered in `src/App.tsx` + "Vouchers" item in `AppSidebar.tsx`. Follows existing `PaymentsPage` patterns (antd table, frosted modal, `requireRole` admin fetch). Visual language copied from existing admin pages (repo has no DESIGN.md; derive, don't invent).
- Roles: `super_admin`, `payment_admin` (same as payments).
- Table columns: code, type/value, used/quota, event (or "Semua"), validity window, status (active/inactive/expired).
- Create/edit modal: code (auto-uppercased), type, value, maxDiscount (percent only), quota, event picker (optional), validFrom/validUntil, isActive.
- Actions: toggle active; delete — hard delete only when `usedCount = 0`, otherwise deactivate only.
- Row click → redemption history drawer: name, email, orderId, discount, timestamp.

### Admin API

- `api/admin-vouchers.ts` — GET (list, with event name join), POST (create, validate: type enum, value bounds, quota ≥ 0, code unique — friendly error on duplicate), PATCH (update fields / toggle; code immutable after creation), DELETE (only if `usedCount = 0`).
- `api/admin-voucher-redemptions.ts` — GET `?voucherId=` (history, newest first).

All behind `requireRole(event, ['super_admin', 'payment_admin'])`.

## Edge cases

- Discount > total → clamped to total (voucher still fully "consumes" its single use).
- Percent 100 / full nominal → free path at checkout; redemption recorded immediately via settle helper.
- Voucher on free event (total 0) → rejected with clear message.
- Case sensitivity: user types `earlybird` → matches `EARLYBIRD`.
- Stale pending re-checkout (existing 24h cleanup) carries no voucher residue — voucherCode lives on the new rows only.
- Midtrans item_details sum must equal gross_amount after discount → proportional price reduction, remainder absorbed into the first line.

## Testing

No test framework in repo (no vitest/jest). Use Node built-in runner via tsx:

- `src/lib/__tests__/order-id.test.ts` (or `scripts/test-order-id.mjs` if import friction): format regex, length cap, category slug rules, WIB timestamp known-instant check.
- Voucher calc tests: nominal clamp, percent cap, percent+maxDiscount, zero-total rejection.

Run: `npx tsx --test <file>` (documented in the implementation plan; add npm script `test` while at it).

## Out of scope (explicitly skipped)

- Voucher usage analytics/charts, bulk voucher generation, CSV export
- Auto-generated voucher codes (admin types them)
- Per-category voucher scoping (event-level only)
- Releasing quota on payment expiry (settlement-only counting makes it unnecessary)
- Unique DB constraint on orderId (impossible with bulk rows sharing orderId)
