# LMPT Order ID + Voucher System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the order ID scheme with human-readable `LMPT-{CATEGORY}-{HHMMDDMMYYYY}-{NNNNN}` IDs and add a full voucher system (admin CRUD + quota + usage history, checkout redemption).

**Architecture:** Pure helpers in `src/lib/` (order-id, voucher) tested with Node's built-in runner; raw-SQL startup migrations in `src/lib/migrations.ts` create the new tables (mirrored in `prisma/schema.prisma`); serverless-style handlers in `api/` (auto-routed by `server.ts`: `/api/foo-bar` → `api/foo-bar.ts`); admin page follows the Tailwind pattern of `PaymentsPage.tsx`.

**Tech Stack:** Express 5 + mysql2 raw SQL (`query` from `src/lib/db.ts`), Prisma 7 (schema parity only), React 18 + Tailwind, Node built-in `node:test` via tsx.

**Spec:** `docs/superpowers/specs/2026-09-23-order-id-voucher-design.md`

## Global Constraints

- Order ID format: `LMPT-{CATEGORY}-{HHMMDDMMYYYY}-{5 digits}`, max ~36 chars, NO colon (Midtrans order_id allows only alphanumerics, `-`, `_`, `.`; ≤50 chars).
- Timestamp is Asia/Jakarta (WIB), `HHMM` + `DDMMYYYY`.
- Voucher `quota = 0` means unlimited (matches `Category.quota` semantics).
- Redemption quota decrements only at settlement (webhook, client polling, admin settle, free path), idempotent via `VoucherRedemption.orderId` unique.
- Discount always clamped to `[0, total]`. Vouchers rejected on total = 0.
- Admin endpoints behind `requireRole(event, ['super_admin', 'payment_admin'])`.
- Commit messages WITHOUT Co-Authored-By footer (user rule). Do not push to `prod`; default push is `layoutadmin` + `staging` only, and only when asked.
- Midtrans `item_details` sum must equal `gross_amount`.
- DB writes go through `query(sql, params)` (mysql2 placeholders) — no string interpolation of user input.
- One refinement vs spec: the DB collision-retry loop for order IDs lives inline in `api/checkout.ts` (5 lines) so `src/lib/order-id.ts` stays pure/import-safe for tests.

---

### Task 1: Order ID helper (pure) + tests

**Files:**
- Create: `src/lib/order-id.ts`
- Create: `src/lib/__tests__/order-id.test.ts`

**Interfaces:**
- Consumes: nothing (stdlib only — must NOT import `src/lib/db.ts`, tests import this file without a DB).
- Produces:
  - `slugCategory(name: string): string`
  - `formatWibTimestamp(now?: Date): string`
  - `buildOrderId(categoryName: string, now?: Date): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/order-id.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert';
import { slugCategory, formatWibTimestamp, buildOrderId } from '../order-id.ts';

test('slugCategory strips non-alphanumerics, uppercases, caps at 12', () => {
  assert.equal(slugCategory('10K TNI/POLRI'), '10KTNIPOLRI');
  assert.equal(slugCategory('Fun Run 5K'), 'FUNRUN5K');
  assert.equal(slugCategory('   '), 'EVENT'); // empty fallback
  assert.equal(slugCategory('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'ABCDEFGHIJKL'); // 12 cap
});

test('formatWibTimestamp is HHMM+DDMMYYYY in WIB', () => {
  // 2026-09-22T09:58:00Z == 16:58 WIB, 22/09/2026
  assert.equal(formatWibTimestamp(new Date('2026-09-22T09:58:00Z')), '165822092026');
  // midnight edge: 17:00 WIB previous day -> never emit hour "24"
  assert.equal(formatWibTimestamp(new Date('2026-09-22T17:00:00Z')), '000123092026');
});

test('buildOrderId matches LMPT-{CAT}-{TS}-{5digits}', () => {
  const id = buildOrderId('10K TNI/POLRI', new Date('2026-09-22T09:58:00Z'));
  assert.match(id, /^LMPT-10KTNIPOLRI-165822092026-\d{5}$/);
  assert.ok(id.length <= 50);
});

test('buildOrderId random segment varies', () => {
  const a = buildOrderId('X', new Date());
  const b = buildOrderId('X', new Date());
  // 1/100000 chance of equality per pair; two pairs compared, effectively never equal
  assert.ok(a !== b || buildOrderId('X', new Date()) !== a);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/__tests__/order-id.test.ts`
Expected: FAIL — cannot resolve `../order-id.ts`.

- [ ] **Step 3: Write the implementation**

`src/lib/order-id.ts`:

```ts
// Pure helpers — no DB import (tests run without a database).

export function slugCategory(name: string): string {
  const slug = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (slug || 'EVENT').slice(0, 12);
}

export function formatWibTimestamp(now: Date = new Date()): string {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now)) {
    parts[p.type] = p.value;
  }
  const hh = parts.hour === '24' ? '00' : parts.hour; // id-ID may render midnight as 24
  return `${hh}${parts.minute}${parts.day}${parts.month}${parts.year}`;
}

export function buildOrderId(categoryName: string, now: Date = new Date()): string {
  const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  return `LMPT-${slugCategory(categoryName)}-${formatWibTimestamp(now)}-${rand}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/lib/__tests__/order-id.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Add npm test script and commit**

In `package.json` scripts add:

```json
"test": "tsx --test src/lib/__tests__/order-id.test.ts src/lib/__tests__/voucher.test.ts"
```

(The voucher test file arrives in Task 4; until then run tests by explicit path as above.)

```bash
git add src/lib/order-id.ts src/lib/__tests__/order-id.test.ts package.json
git commit -m "feat(order): LMPT order id helpers with tests"
```

---

### Task 2: Wire new order ID into checkout

**Files:**
- Modify: `api/checkout.ts:172` (the `const orderId = \`LMPAT-...\`` line) and the import block at the top.

**Interfaces:**
- Consumes: `buildOrderId(categoryName: string, now?: Date): string` from Task 1.
- Produces: checkout orders now carry `LMPT-...` IDs. No signature changes.

- [ ] **Step 1: Add import**

At the top of `api/checkout.ts`, after the other `src/lib` imports:

```ts
import { buildOrderId } from '../src/lib/order-id';
```

- [ ] **Step 2: Replace the ID generation with collision-checked loop**

Replace line 172:

```ts
const orderId = `LMPAT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
```

with:

```ts
// ponytail: 3-try collision check via SELECT; unique DB index impossible (bulk rows share orderId)
let orderId = '';
for (let attempt = 0; attempt < 3; attempt++) {
  const candidate = buildOrderId(categories[0].name);
  const clash: any = await query('SELECT 1 FROM EventRegistration WHERE orderId = ? LIMIT 1', [candidate]);
  if (clash.length === 0) { orderId = candidate; break; }
  if (attempt === 2) orderId = candidate; // accept residual risk rather than fail checkout
}
```

- [ ] **Step 3: Verify manually**

Run the dev stack (`npm run dev:full`) against the dev DB, register on any event, and confirm the created `EventRegistration.orderId` matches `LMPT-{CATEGORY}-{HHMMDDMMYYYY}-{NNNNN}` and the Midtrans Snap popup opens (Snap accepting the order_id proves the charset/length are valid). Check with:

```bash
npx tsx -e "import('./src/lib/db').then(async ({query}) => { const r = await query('SELECT orderId FROM EventRegistration ORDER BY createdAt DESC LIMIT 3'); console.log(r); process.exit(0); })"
```

- [ ] **Step 4: Commit**

```bash
git add api/checkout.ts
git commit -m "feat(order): use LMPT scheme for checkout order ids"
```

---

### Task 3: Schema — Voucher, VoucherRedemption, registration columns

**Files:**
- Modify: `prisma/schema.prisma` (add 2 models + 2 fields on `EventRegistration`)
- Modify: `src/lib/migrations.ts` (add Migrations 5–7)

**Interfaces:**
- Consumes: `query` from `./db`.
- Produces (SQL, used by later tasks):
  - `Voucher(id, code UNIQUE, discountType, value, maxDiscount, quota, usedCount, eventId, validFrom, validUntil, isActive, createdAt, updatedAt)`
  - `VoucherRedemption(id, voucherId, orderId UNIQUE, email, name, eventId, discountAmount, createdAt)`
  - `EventRegistration.voucherCode VARCHAR(64) NULL`, `EventRegistration.discountAmount INT NOT NULL DEFAULT 0`

- [ ] **Step 1: Extend Prisma schema**

In `prisma/schema.prisma`, add to `EventRegistration` (near the other optional columns, e.g. after `snapUrl`):

```prisma
  voucherCode       String?
  discountAmount    Int       @default(0)
```

Append the two models at the end of the file:

```prisma
model Voucher {
  id           String              @id @default(uuid())
  code         String              @unique
  discountType String
  value        Int
  maxDiscount  Int?
  quota        Int                 @default(0)
  usedCount    Int                 @default(0)
  eventId      String?
  validFrom    DateTime?
  validUntil   DateTime?
  isActive     Boolean             @default(true)
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  redemptions  VoucherRedemption[]

  @@index([eventId])
}

model VoucherRedemption {
  id             String   @id @default(uuid())
  voucherId      String
  orderId        String   @unique
  email          String
  name           String
  eventId        String
  discountAmount Int
  createdAt      DateTime @default(now())
  voucher        Voucher  @relation(fields: [voucherId], references: [id], onDelete: Cascade)

  @@index([voucherId])
  @@index([email])
}
```

- [ ] **Step 2: Add startup migrations**

In `src/lib/migrations.ts`, before the final `console.log('[MIGRATIONS] All migrations complete ✅')`, add:

```ts
    // Migration 5: Voucher table
    await query(`CREATE TABLE IF NOT EXISTS Voucher (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      discountType VARCHAR(16) NOT NULL,
      value INT NOT NULL,
      maxDiscount INT NULL,
      quota INT NOT NULL DEFAULT 0,
      usedCount INT NOT NULL DEFAULT 0,
      eventId VARCHAR(36) NULL,
      validFrom DATETIME(3) NULL,
      validUntil DATETIME(3) NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX Voucher_eventId_idx (eventId)
    )`);
    console.log('[MIGRATIONS] ✅ Voucher table ready');

    // Migration 6: VoucherRedemption table (usage history)
    await query(`CREATE TABLE IF NOT EXISTS VoucherRedemption (
      id VARCHAR(36) PRIMARY KEY,
      voucherId VARCHAR(36) NOT NULL,
      orderId VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      eventId VARCHAR(36) NOT NULL,
      discountAmount INT NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX VoucherRedemption_voucherId_idx (voucherId),
      INDEX VoucherRedemption_email_idx (email)
    )`);
    console.log('[MIGRATIONS] ✅ VoucherRedemption table ready');

    // Migration 7: voucher snapshot columns on EventRegistration
    for (const col of [
      'ALTER TABLE EventRegistration ADD COLUMN voucherCode VARCHAR(64) NULL',
      'ALTER TABLE EventRegistration ADD COLUMN discountAmount INT NOT NULL DEFAULT 0',
    ]) {
      try {
        await query(col);
        console.log(`[MIGRATIONS] ✅ ${col.split('ADD COLUMN ')[1]} added`);
      } catch (e: any) {
        if (!e.message?.includes('Duplicate column name')) throw e;
      }
    }
```

- [ ] **Step 3: Run migrations against the dev DB**

```bash
npx tsx -e "import('./src/lib/migrations').then(m => m.runMigrations()).then(() => process.exit(0))"
```

Expected output contains `✅ Voucher table ready`, `✅ VoucherRedemption table ready`, `voucherCode added`, `discountAmount added`. Run it a second time — must succeed with no errors (idempotent).

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/migrations.ts
git commit -m "feat(voucher): schema and startup migrations for vouchers"
```

---

### Task 4: Voucher lib (calculateDiscount, validateVoucher, settleVoucherRedemption) + tests

**Files:**
- Create: `src/lib/voucher.ts`
- Create: `src/lib/__tests__/voucher.test.ts`

**Interfaces:**
- Consumes: `query` from `./db`.
- Produces (used by Tasks 5–8):
  - `calculateDiscount(discountType: 'nominal'|'percent', value: number, maxDiscount: number|null|undefined, total: number): number`
  - `type VoucherCheck = { valid: true; voucher: any; discountAmount: number; finalAmount: number } | { valid: false; reason: string }`
  - `validateVoucher(code: string, eventId: string, total: number, email?: string): Promise<VoucherCheck>`
  - `settleVoucherRedemption(orderId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/voucher.test.ts` (pure function only — importing `voucher.ts` must not open a DB connection; mysql2 pools connect lazily, and `DATABASE_URL` only needs to parse — set a dummy one when no `.env` exists):

```ts
import { test } from 'node:test';
import assert from 'node:assert';
import { calculateDiscount } from '../voucher.ts';

test('nominal discount clamps to total', () => {
  assert.equal(calculateDiscount('nominal', 25000, null, 100000), 25000);
  assert.equal(calculateDiscount('nominal', 150000, null, 100000), 100000);
  assert.equal(calculateDiscount('nominal', 0, null, 100000), 0);
});

test('percent discount floors and clamps', () => {
  assert.equal(calculateDiscount('percent', 20, null, 99900), 19980); // floor(99900*0.2)
  assert.equal(calculateDiscount('percent', 100, null, 75000), 75000);
  assert.equal(calculateDiscount('percent', 150, null, 75000), 75000); // >100% clamps to total
});

test('percent discount respects maxDiscount cap', () => {
  assert.equal(calculateDiscount('percent', 50, 30000, 100000), 30000);
  assert.equal(calculateDiscount('percent', 10, 30000, 100000), 10000); // under cap untouched
});

test('zero total yields zero discount', () => {
  assert.equal(calculateDiscount('percent', 50, null, 0), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/__tests__/voucher.test.ts`
Expected: FAIL — cannot resolve `../voucher.ts`.

- [ ] **Step 3: Write the implementation**

`src/lib/voucher.ts`:

```ts
import crypto from 'crypto';
import { query } from './db';

export function calculateDiscount(
  discountType: string,
  value: number,
  maxDiscount: number | null | undefined,
  total: number,
): number {
  if (total <= 0 || !value || value <= 0) return 0;
  let d = discountType === 'percent' ? Math.floor((total * value) / 100) : value;
  if (discountType === 'percent' && maxDiscount && maxDiscount > 0) d = Math.min(d, maxDiscount);
  return Math.max(0, Math.min(d, total));
}

export type VoucherCheck =
  | { valid: true; voucher: any; discountAmount: number; finalAmount: number }
  | { valid: false; reason: string };

// ponytail: validity window compared in JS from DATETIME values; day-granularity is fine,
// move checks into SQL with NOW() if minute-precision across server timezones ever matters
export async function validateVoucher(code: string, eventId: string, total: number, email?: string): Promise<VoucherCheck> {
  const norm = String(code || '').trim().toUpperCase();
  if (!norm) return { valid: false, reason: 'Kode voucher kosong' };

  const rows: any = await query('SELECT * FROM Voucher WHERE code = ? LIMIT 1', [norm]);
  const v = rows[0];
  if (!v) return { valid: false, reason: 'Kode voucher tidak ditemukan' };
  if (!v.isActive) return { valid: false, reason: 'Voucher tidak aktif' };
  if (v.validFrom && new Date(v.validFrom) > new Date()) return { valid: false, reason: 'Voucher belum berlaku' };
  if (v.validUntil && new Date(v.validUntil) < new Date()) return { valid: false, reason: 'Voucher sudah kedaluwarsa' };
  if (v.eventId && v.eventId !== eventId) return { valid: false, reason: 'Voucher tidak berlaku untuk event ini' };
  if (v.quota > 0 && v.usedCount >= v.quota) return { valid: false, reason: 'Kuota voucher sudah habis' };
  if (total <= 0) return { valid: false, reason: 'Event ini gratis, voucher tidak diperlukan' };
  if (email) {
    const used: any = await query(
      'SELECT 1 FROM VoucherRedemption WHERE voucherId = ? AND email = ? LIMIT 1',
      [v.id, email],
    );
    if (used.length > 0) return { valid: false, reason: 'Kamu sudah pernah memakai voucher ini' };
  }

  const discountAmount = calculateDiscount(v.discountType, v.value, v.maxDiscount, total);
  return { valid: true, voucher: v, discountAmount, finalAmount: total - discountAmount };
}

// Called from every code path that sets paymentStatus = 'settlement'.
// Idempotent: unique orderId makes the INSERT fail with ER_DUP_ENTRY on repeats.
export async function settleVoucherRedemption(orderId: string): Promise<void> {
  const regs: any = await query(
    'SELECT voucherCode, email, name, eventId, discountAmount FROM EventRegistration WHERE orderId = ? LIMIT 1',
    [orderId],
  );
  const reg = regs[0];
  if (!reg?.voucherCode) return;

  const vouchers: any = await query('SELECT id FROM Voucher WHERE code = ? LIMIT 1', [reg.voucherCode]);
  if (!vouchers[0]) return;

  try {
    await query(
      'INSERT INTO VoucherRedemption (id, voucherId, orderId, email, name, eventId, discountAmount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [crypto.randomUUID(), vouchers[0].id, orderId, reg.email, reg.name, reg.eventId, reg.discountAmount || 0],
    );
    await query('UPDATE Voucher SET usedCount = usedCount + 1 WHERE id = ?', [vouchers[0].id]);
  } catch (e: any) {
    if (e.code !== 'ER_DUP_ENTRY') throw e; // already settled
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/lib/__tests__/voucher.test.ts` (and `npm test` once both files exist)
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voucher.ts src/lib/__tests__/voucher.test.ts
git commit -m "feat(voucher): validation, discount calc and settlement helper"
```

---

### Task 5: Settlement hooks (quota decrement at payment success)

**Files:**
- Modify: `api/webhook-midtrans.ts` (~line 130, the `if (paymentStatus === 'settlement')` block)
- Modify: `api/check-payment-status.ts` (~line 91, same-shaped block)
- Modify: `api/admin-settle-payment.ts` (after the `assignAutoBibsIfEnabled(orderId)` call)

**Interfaces:**
- Consumes: `settleVoucherRedemption(orderId: string): Promise<void>` from Task 4.
- Produces: nothing new.

- [ ] **Step 1: webhook-midtrans.ts**

Add import at top:

```ts
import { settleVoucherRedemption } from '../src/lib/voucher';
```

Inside `if (paymentStatus === 'settlement') {` (the block that calls `assignAutoBibsIfEnabled(order_id)`), add as its first statement:

```ts
        try {
          await settleVoucherRedemption(order_id);
        } catch (e) {
          console.error('[WEBHOOK-MIDTRANS] Error settling voucher:', e);
        }
```

- [ ] **Step 2: check-payment-status.ts**

Add import at top:

```ts
import { settleVoucherRedemption } from '../src/lib/voucher';
```

Inside its `if (paymentStatus === 'settlement') {` block (before `assignAutoBibsIfEnabled(orderId)`):

```ts
        try {
          await settleVoucherRedemption(orderId);
        } catch (e) {
          console.error('[CHECK-PAYMENT] Error settling voucher:', e);
        }
```

- [ ] **Step 3: admin-settle-payment.ts**

Add import at top:

```ts
import { settleVoucherRedemption } from '../src/lib/voucher';
```

Next to the existing `await assignAutoBibsIfEnabled(orderId);` call add:

```ts
    await settleVoucherRedemption(orderId);
```

- [ ] **Step 4: Verify idempotency manually**

With the dev stack running and a voucher-bearing settled order (create one after Task 7 is wired, or temporarily set `voucherCode` on an existing order row), call the same settle path twice (e.g. re-run admin settle) and confirm `SELECT COUNT(*) FROM VoucherRedemption WHERE orderId = ?` stays 1 and `usedCount` only incremented once.

- [ ] **Step 5: Commit**

```bash
git add api/webhook-midtrans.ts api/check-payment-status.ts api/admin-settle-payment.ts
git commit -m "feat(voucher): record redemption on every settlement path"
```

---

### Task 6: Checkout voucher flow + validate endpoint

**Files:**
- Modify: `api/checkout.ts` (destructure, discount block, INSERT columns, free-path condition, Snap payload, activity log, response)
- Create: `api/voucher-validate.ts`

**Interfaces:**
- Consumes: `validateVoucher` from Task 4.
- Produces:
  - `POST /api/checkout` accepts optional `voucherCode: string`; response gains `discountAmount: number` and `grossAmount` becomes the post-discount amount.
  - `POST /api/voucher/validate` `{ code, eventId, totalAmount, email? }` → `{ valid: boolean, reason?: string, discountAmount?: number, finalAmount?: number }` (public, same as checkout).

- [ ] **Step 1: Create the validate endpoint**

`api/voucher-validate.ts`:

```ts
import { validateVoucher } from '../src/lib/voucher';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const { code, eventId, totalAmount, email } = parseBody(event);
    if (!code || !eventId) return errorResponse('code and eventId are required', 400);

    const check = await validateVoucher(String(code), eventId, Number(totalAmount) || 0, email);
    if (!check.valid) return successResponse({ valid: false, reason: check.reason });

    return successResponse({
      valid: true,
      discountAmount: check.discountAmount,
      finalAmount: check.finalAmount,
      code: check.voucher.code,
    });
  } catch (error: any) {
    console.error('[VOUCHER-VALIDATE] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
```

- [ ] **Step 2: checkout.ts — accept and validate the voucher**

At the top add:

```ts
import { validateVoucher, settleVoucherRedemption } from '../src/lib/voucher';
```

In the destructuring (line ~23) add `voucherCode`:

```ts
    let { eventId, categoryId, email, customData, bulkParticipants, name, phoneNumber, gender, bloodType, emergencyName, emergencyPhone, tshirtSize, bibName, notes, dateOfBirth, voucherCode } = body;
```

After the `totalGrossAmount` computation (line ~170) and BEFORE the orderId loop, insert:

```ts
    let discountAmount = 0;
    if (voucherCode) {
      const check = await validateVoucher(String(voucherCode), eventId, totalGrossAmount, email);
      if (!check.valid) return errorResponse(check.reason, 400);
      discountAmount = check.discountAmount;
    }
    const finalAmount = totalGrossAmount - discountAmount;
```

- [ ] **Step 3: checkout.ts — persist voucher on each registration row**

In the `INSERT INTO EventRegistration` statement add the two columns after `snapUrl`-position columns — concretely extend the column list with `, voucherCode, discountAmount` and the values with `, ?, ?`, binding `[..., orderId, itemGrossAmount, ...]` → append `voucherCode || null, discountAmount` to the params array. Full replacement INSERT:

```ts
        await query(
          `INSERT INTO EventRegistration 
            (id, eventId, categoryId, email, name, phoneNumber, gender, bloodType, emergencyName, emergencyPhone, tshirtSize, bibName, notes, orderId, grossAmount, dateOfBirth, customData, voucherCode, discountAmount, paymentStatus, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
          [regId, eventId, categoryId, email, p.name, p.phoneNumber, p.gender, p.bloodType || null, p.emergencyName || null, p.emergencyPhone || null, p.tshirtSize || null, p.bibName || null, p.notes || null, orderId, itemGrossAmount, p.dateOfBirth || null, p.customData ? JSON.stringify(p.customData) : null, voucherCode || null, discountAmount]
        );
```

- [ ] **Step 4: checkout.ts — free path uses finalAmount and settles immediately**

Change `if (totalGrossAmount === 0) {` → `if (finalAmount === 0) {`, and inside that block, right after the loop that sets `paymentStatus = 'settlement'`, add:

```ts
      try {
        await settleVoucherRedemption(orderId);
      } catch (e) {
        console.error('[CHECKOUT] Error settling voucher:', e);
      }
```

(The no-Midtrans-config early return further down can keep using `totalGrossAmount` — it is only reachable when there is nothing to pay.)

- [ ] **Step 5: checkout.ts — Snap payload reflects the discount**

Replace the `item_details` block so a discounted order is one exact-sum line:

```ts
      item_details: discountAmount > 0
        ? [{ id: categoryId, price: finalAmount, quantity: 1, name: `${events[0].name} - ${categories[0].name} (setelah diskon voucher)`.substring(0, 50) }]
        : [
            { id: categoryId, price: categoryPrice, quantity: qty, name: `${events[0].name} - ${categories[0].name}`.substring(0, 50) },
            ...(bibExtraCharge > 0 ? [{ id: 'bib-custom', price: bibExtraCharge, quantity: qty, name: `Custom BIB Name` }] : []),
          ],
```

And in `transaction_details` change `gross_amount: totalGrossAmount` → `gross_amount: finalAmount`.

- [ ] **Step 6: checkout.ts — log + response**

After the existing `logActivity('registration.created', ...)` for the paid path, add:

```ts
    if (voucherCode) {
      await logActivity('voucher.applied', `Voucher ${String(voucherCode).toUpperCase()} dipakai untuk ${orderId} (diskon Rp ${discountAmount.toLocaleString('id-ID')})`, email, eventId, { orderId, voucherCode: String(voucherCode).toUpperCase(), discountAmount });
    }
```

In the final `successResponse({...})` change `grossAmount: totalGrossAmount` → `grossAmount: finalAmount` and add `discountAmount,`.

- [ ] **Step 7: Verify end-to-end (with a seed voucher)**

```bash
npx tsx -e "import('./src/lib/db').then(async ({query}) => { await query(\"INSERT INTO Voucher (id, code, discountType, value, quota, isActive, createdAt, updatedAt) VALUES (UUID(), 'TEST20', 'percent', 20, 0, TRUE, NOW(), NOW())\"); const r = await query('SELECT * FROM Voucher'); console.log(r); process.exit(0); })"
```

Then with the dev stack: `curl -X POST localhost:PORT/api/voucher/validate -H 'Content-Type: application/json' -d '{"code":"test20","eventId":"<real-event-id>","totalAmount":100000}'` → expect `{"valid":true,"discountAmount":20000,...}`. Complete a sandbox checkout with `voucherCode: "TEST20"` and confirm the Snap popup shows the discounted amount and `EventRegistration.discountAmount = 20000`.

- [ ] **Step 8: Commit**

```bash
git add api/checkout.ts api/voucher-validate.ts
git commit -m "feat(voucher): apply voucher at checkout with server-side validation"
```

---

### Task 7: Admin voucher API

**Files:**
- Create: `api/admin-vouchers.ts`
- Create: `api/admin-voucher-redemptions.ts`

**Interfaces:**
- Consumes: `requireRole` from `../src/lib/jwt`; `query`; `logActivity`.
- Produces:
  - `GET /api/admin-vouchers[?eventId=]` → `{ vouchers: [...] }` with `eventName` joined
  - `POST /api/admin-vouchers` `{ code, discountType, value, maxDiscount?, quota, eventId?, validFrom?, validUntil?, isActive? }`
  - `PATCH /api/admin-vouchers` `{ id, ...fields }` (code immutable)
  - `DELETE /api/admin-vouchers?id=...` (only when `usedCount = 0`)
  - `GET /api/admin-voucher-redemptions?voucherId=...` → `{ redemptions: [...] }`
  - All require roles `super_admin`, `payment_admin`.

- [ ] **Step 1: Create admin-vouchers.ts**

```ts
import { query } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';
import { logActivity } from '../src/lib/activity-logger';

const ROLES = ['super_admin', 'payment_admin'];

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  const auth = requireRole(event, ROLES);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    if (event.httpMethod === 'GET') {
      const eventId = event.queryStringParameters?.eventId;
      const vouchers: any = await query(
        `SELECT v.*, e.name as eventName FROM Voucher v LEFT JOIN Event e ON v.eventId = e.id
         ${eventId ? 'WHERE v.eventId = ?' : ''} ORDER BY v.createdAt DESC`,
        eventId ? [eventId] : []
      );
      return successResponse({ vouchers });
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
      const code = String(body.code || '').trim().toUpperCase();
      const discountType = body.discountType;
      const value = Number(body.value);
      if (!/^[A-Z0-9-]{3,32}$/.test(code)) return errorResponse('Kode voucher 3-32 karakter, hanya huruf/angka/tanda minus', 400);
      if (!['nominal', 'percent'].includes(discountType)) return errorResponse('discountType harus nominal atau percent', 400);
      if (!Number.isInteger(value) || value <= 0) return errorResponse('value harus angka bulat positif', 400);
      if (discountType === 'percent' && value > 100) return errorResponse('percent maksimal 100', 400);
      const maxDiscount = body.maxDiscount != null ? Number(body.maxDiscount) : null;
      if (maxDiscount != null && (!Number.isInteger(maxDiscount) || maxDiscount <= 0)) return errorResponse('maxDiscount harus angka bulat positif', 400);
      const quota = Number(body.quota ?? 0);
      if (!Number.isInteger(quota) || quota < 0) return errorResponse('quota harus angka bulat >= 0 (0 = unlimited)', 400);
      if (body.eventId) {
        const ev: any = await query('SELECT id FROM Event WHERE id = ? LIMIT 1', [body.eventId]);
        if (ev.length === 0) return errorResponse('Event tidak ditemukan', 404);
      }
      const validFrom = parseDate(body.validFrom);
      const validUntil = parseDate(body.validUntil);
      if (body.validFrom && !validFrom) return errorResponse('validFrom tidak valid', 400);
      if (body.validUntil && !validUntil) return errorResponse('validUntil tidak valid', 400);

      try {
        const res: any = await query(
          `INSERT INTO Voucher (id, code, discountType, value, maxDiscount, quota, eventId, validFrom, validUntil, isActive, createdAt, updatedAt)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [code, discountType, value, maxDiscount, quota, body.eventId || null, validFrom, validUntil, body.isActive !== false]
        );
        await logActivity('voucher.created', `Voucher ${code} dibuat`, 'admin', body.eventId || null, { code, discountType, value, quota });
        return successResponse({ ok: true });
      } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') return errorResponse('Kode voucher sudah digunakan', 400);
        throw e;
      }
    }

    if (event.httpMethod === 'PATCH') {
      if (!body.id) return errorResponse('id is required', 400);
      const sets: string[] = [];
      const params: any[] = [];
      const num = (v: any, name: string, min: number) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < min) throw new Error(`${name} harus angka bulat >= ${min}`);
        return n;
      };
      try {
        if (body.value !== undefined) { sets.push('value = ?'); params.push(num(body.value, 'value', 1)); }
        if (body.maxDiscount !== undefined) { sets.push('maxDiscount = ?'); params.push(body.maxDiscount == null ? null : num(body.maxDiscount, 'maxDiscount', 1)); }
        if (body.quota !== undefined) { sets.push('quota = ?'); params.push(num(body.quota, 'quota', 0)); }
        if (body.eventId !== undefined) { sets.push('eventId = ?'); params.push(body.eventId || null); }
        if (body.validFrom !== undefined) { sets.push('validFrom = ?'); params.push(parseDate(body.validFrom)); }
        if (body.validUntil !== undefined) { sets.push('validUntil = ?'); params.push(parseDate(body.validUntil)); }
        if (body.isActive !== undefined) { sets.push('isActive = ?'); params.push(!!body.isActive); }
      } catch (e: any) {
        return errorResponse(e.message, 400);
      }
      if (sets.length === 0) return errorResponse('Tidak ada field untuk diupdate', 400);
      sets.push('updatedAt = NOW()');
      params.push(body.id);
      await query(`UPDATE Voucher SET ${sets.join(', ')} WHERE id = ?`, params);
      await logActivity('voucher.updated', `Voucher diperbarui`, 'admin', null, { id: body.id, fields: sets.map(s => s.split(' ')[0]) });
      return successResponse({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return errorResponse('id is required', 400);
      const rows: any = await query('SELECT code, usedCount FROM Voucher WHERE id = ? LIMIT 1', [id]);
      if (rows.length === 0) return errorResponse('Voucher tidak ditemukan', 404);
      if (rows[0].usedCount > 0) return errorResponse('Voucher sudah pernah dipakai, nonaktifkan saja', 400);
      await query('DELETE FROM Voucher WHERE id = ?', [id]);
      await logActivity('voucher.deleted', `Voucher ${rows[0].code} dihapus`, 'admin', null, { id });
      return successResponse({ ok: true });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('[ADMIN-VOUCHERS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
```

- [ ] **Step 2: Create admin-voucher-redemptions.ts**

```ts
import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'payment_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const voucherId = event.queryStringParameters?.voucherId;
    if (!voucherId) return errorResponse('voucherId is required', 400);
    const redemptions: any = await query(
      'SELECT * FROM VoucherRedemption WHERE voucherId = ? ORDER BY createdAt DESC',
      [voucherId]
    );
    return successResponse({ redemptions });
  } catch (error: any) {
    console.error('[ADMIN-VOUCHER-REDEMPTIONS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
```

- [ ] **Step 3: Verify with curl (dev stack + logged-in admin cookie/token)**

```bash
curl -s localhost:PORT/api/admin-vouchers -H "Authorization: Bearer <admin-token>" # → {"vouchers":[...]}
curl -s -X POST localhost:PORT/api/admin-vouchers -H "Authorization: Bearer <admin-token>" -H 'Content-Type: application/json' -d '{"code":"EARLYBIRD","discountType":"nominal","value":25000,"quota":10}'
# repeat same POST → 400 "Kode voucher sudah digunakan"
curl -s -X POST localhost:PORT/api/admin-vouchers -H "Authorization: Bearer <admin-token>" -H 'Content-Type: application/json' -d '{"code":"X","discountType":"percent","value":200}' # → 400 code format
```

- [ ] **Step 4: Commit**

```bash
git add api/admin-vouchers.ts api/admin-voucher-redemptions.ts
git commit -m "feat(voucher): admin CRUD API with redemption history"
```

---

### Task 8: Checkout UI — voucher field in EventPage

**Files:**
- Modify: `src/pages/EventPage.tsx` — state block (~line 467), price block (~line 513), checkout body (~line 594), step-3 summary UI (~line 3479).

**Interfaces:**
- Consumes: `POST /api/voucher/validate`, `POST /api/checkout` with `voucherCode`.
- Produces: user-facing voucher entry + discounted total display.

- [ ] **Step 1: Add state (after the `otpCode`/`otpLoading` state lines ~470)**

```ts
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherResult, setVoucherResult] = useState<{
    valid: boolean;
    discountAmount?: number;
    reason?: string;
  } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
```

- [ ] **Step 2: Reset stale voucher when the total changes (after the `totalPrice` definition ~line 515)**

```ts
  // Voucher preview is only valid for the current total — reset when it changes
  useEffect(() => {
    setVoucherResult(null);
  }, [totalPrice, regForm.email]);
```

- [ ] **Step 3: Add apply handler + final price (next to `handleCheckout`)**

```ts
  const finalPrice = voucherResult?.valid
    ? totalPrice - (voucherResult.discountAmount || 0)
    : totalPrice;

  const applyVoucher = async () => {
    if (!voucherCode.trim()) {
      message.error("Masukkan kode voucher terlebih dahulu");
      return;
    }
    setVoucherLoading(true);
    try {
      const res = await fetch("/api/voucher/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucherCode,
          eventId: event?.id,
          totalAmount: totalPrice,
          email: regForm.email,
        }),
      });
      const data = await res.json();
      setVoucherResult(data.valid ? { valid: true, discountAmount: data.discountAmount } : { valid: false, reason: data.reason });
    } catch {
      setVoucherResult({ valid: false, reason: "Gagal memeriksa voucher" });
    } finally {
      setVoucherLoading(false);
    }
  };
```

- [ ] **Step 4: Send voucherCode in the checkout body (~line 597)**

```ts
        body: JSON.stringify({
          eventId: event?.id,
          ...regForm,
          bulkParticipants: participantsToSend,
          voucherCode: voucherResult?.valid ? voucherCode.trim().toUpperCase() : undefined,
        }),
```

- [ ] **Step 5: Step-3 UI — voucher input above the total, discounted total display**

Replace the total-payment card (~line 3479) with:

```tsx
                  {/* Voucher */}
                  {totalPrice > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                          placeholder="Kode voucher (opsional)"
                          className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-stone-400"
                        />
                        <Button size="large" loading={voucherLoading} onClick={applyVoucher}>
                          Terapkan
                        </Button>
                      </div>
                      {voucherResult?.valid && (
                        <div className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex justify-between">
                          <span>Voucher diterapkan</span>
                          <span>-Rp {(voucherResult.discountAmount || 0).toLocaleString("id-ID")}</span>
                        </div>
                      )}
                      {voucherResult && !voucherResult.valid && (
                        <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                          {voucherResult.reason}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-8 rounded-2xl flex flex-col items-center border border-stone-200 bg-stone-50/50 shadow-sm">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">
                      Total Pembayaran
                    </span>
                    {voucherResult?.valid && (
                      <span className="text-lg font-bold text-stone-400 line-through mb-1">
                        Rp {totalPrice.toLocaleString("id-ID")}
                      </span>
                    )}
                    <span className="text-5xl font-black text-stone-900 tracking-tighter">
                      Rp {finalPrice.toLocaleString("id-ID")}
                    </span>
                  </div>
```

And update the pay button label (~line 3512): `{totalPrice <= 0 ? "Daftar Sekarang" : "Bayar Sekarang"}` → `{finalPrice <= 0 ? "Daftar Sekarang" : "Bayar Sekarang"}`.

- [ ] **Step 6: Verify in browser**

With the dev stack and the `TEST20` voucher from Task 6: open an event, reach step 3, enter `test20` → green box shows `-Rp ...`, total shows strikethrough + reduced amount; wrong code shows red reason; Snap popup opens with the discounted amount; complete payment and check `VoucherRedemption` gained a row (via the settle hooks from Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/pages/EventPage.tsx
git commit -m "feat(voucher): voucher code input at checkout with discount preview"
```

---

### Task 9: Admin Vouchers page + routing

**Files:**
- Create: `src/components/admin/pages/VouchersPage.tsx`
- Modify: `src/App.tsx` (import + route)
- Modify: `src/components/admin/AppSidebar.tsx` (menu item after Payments)

**Interfaces:**
- Consumes: `/api/admin-vouchers`, `/api/admin-voucher-redemptions`, `/api/events?showDrafts=true&includeDeleted=true`.
- Produces: `/admin/vouchers` page (list, create/edit modal, toggle, delete, history modal). Tailwind only, matching `PaymentsPage` conventions.

- [ ] **Step 1: Create VouchersPage.tsx**

```tsx
import { useState, useEffect } from 'react';

interface Voucher {
  id: string;
  code: string;
  discountType: 'nominal' | 'percent';
  value: number;
  maxDiscount: number | null;
  quota: number;
  usedCount: number;
  eventId: string | null;
  eventName: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

interface Redemption {
  id: string;
  orderId: string;
  email: string;
  name: string;
  discountAmount: number;
  createdAt: string;
}

const emptyForm = {
  code: '',
  discountType: 'nominal' as 'nominal' | 'percent',
  value: '',
  maxDiscount: '',
  quota: '0',
  eventId: '',
  validFrom: '',
  validUntil: '',
};

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<{id:string;name:string}[]>([]);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [historyFor, setHistoryFor] = useState<Voucher | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-vouchers');
      if (res.ok) setVouchers((await res.json()).vouchers || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch('/api/events?showDrafts=true&includeDeleted=true').then(r=>r.json()).then(data => {
      const list = Array.isArray(data) ? data : [];
      setEvents(list.map((e:any)=>({id:e.id,name:e.name})));
    }).catch(()=>{});
  }, []);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setFormOpen(true); };
  const openEdit = (v: Voucher) => {
    setEditing(v);
    setForm({
      code: v.code,
      discountType: v.discountType,
      value: String(v.value),
      maxDiscount: v.maxDiscount ? String(v.maxDiscount) : '',
      quota: String(v.quota),
      eventId: v.eventId || '',
      validFrom: v.validFrom ? v.validFrom.slice(0, 10) : '',
      validUntil: v.validUntil ? v.validUntil.slice(0, 10) : '',
    });
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        discountType: form.discountType,
        value: Number(form.value),
        quota: Number(form.quota || 0),
        eventId: form.eventId || null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      if (form.discountType === 'percent' && form.maxDiscount) payload.maxDiscount = Number(form.maxDiscount);
      const res = editing
        ? await fetch('/api/admin-vouchers', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: editing.id, ...payload }) })
        : await fetch('/api/admin-vouchers', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ code: form.code, ...payload }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menyimpan'); return; }
      setFormOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: Voucher) => {
    await fetch('/api/admin-vouchers', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: v.id, isActive: !v.isActive }) });
    load();
  };

  const remove = async (v: Voucher) => {
    if (!confirm(`Hapus voucher ${v.code}?`)) return;
    const res = await fetch(`/api/admin-vouchers?id=${v.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Gagal menghapus'); return; }
    load();
  };

  const openHistory = async (v: Voucher) => {
    setHistoryFor(v);
    setRedemptions([]);
    const res = await fetch(`/api/admin-voucher-redemptions?voucherId=${v.id}`);
    if (res.ok) setRedemptions((await res.json()).redemptions || []);
  };

  const filtered = vouchers.filter(v => !search || v.code.toLowerCase().includes(search.toLowerCase()));

  const discountLabel = (v: Voucher) =>
    v.discountType === 'percent'
      ? `${v.value}%${v.maxDiscount ? ` (max Rp ${v.maxDiscount.toLocaleString('id-ID')})` : ''}`
      : `Rp ${v.value.toLocaleString('id-ID')}`;

  const validityLabel = (v: Voucher) => {
    const f = v.validFrom ? new Date(v.validFrom).toLocaleDateString('id-ID') : null;
    const u = v.validUntil ? new Date(v.validUntil).toLocaleDateString('id-ID') : null;
    if (!f && !u) return 'Selamanya';
    return `${f || '...'} – ${u || '...'}`;
  };

  return (
    <div className="flex flex-col">
      <div className="header-row mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-2xl font-black tracking-tight text-gray-900 uppercase">Vouchers</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Kelola kode voucher, kuota, dan riwayat pemakaian.</p>
        </div>
      </div>

      <div className="card mb-4 !p-3 md:!p-4 flex flex-col sm:flex-row gap-2">
        <input className="search flex-1" placeholder="Cari kode voucher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn ghost whitespace-nowrap text-xs" onClick={openCreate}>+ Voucher Baru</button>
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Diskon</th>
              <th className="px-4 py-3">Terpakai / Kuota</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Masa Aktif</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada voucher</td></tr>
            ) : filtered.map(v => (
              <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-black tracking-wider">{v.code}</td>
                <td className="px-4 py-3">{discountLabel(v)}</td>
                <td className="px-4 py-3">{v.usedCount} / {v.quota === 0 ? '∞' : v.quota}</td>
                <td className="px-4 py-3">{v.eventName || 'Semua Event'}</td>
                <td className="px-4 py-3">{validityLabel(v)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${v.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                    {v.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button className="text-blue-600 font-bold text-xs hover:underline mr-3" onClick={() => openHistory(v)}>Riwayat</button>
                  <button className="text-gray-600 font-bold text-xs hover:underline mr-3" onClick={() => openEdit(v)}>Edit</button>
                  <button className="text-yellow-600 font-bold text-xs hover:underline mr-3" onClick={() => toggleActive(v)}>{v.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button className="text-red-600 font-bold text-xs hover:underline" onClick={() => remove(v)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-sm p-4" onClick={() => setFormOpen(false)}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black uppercase tracking-tight">{editing ? `Edit ${editing.code}` : 'Voucher Baru'}</h2>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kode</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 font-black tracking-wider uppercase" value={form.code} disabled={!!editing}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EARLYBIRD" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tipe</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" value={form.discountType} disabled={!!editing}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}>
                  <option value="nominal">Nominal (Rp)</option>
                  <option value="percent">Persen (%)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{form.discountType === 'percent' ? 'Persen' : 'Nominal (Rp)'}</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" type="number" min="1" value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
            {form.discountType === 'percent' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Diskon Maksimal (Rp, opsional)</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" type="number" min="1" value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kuota (0 = unlimited)</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" type="number" min="0" value={form.quota}
                onChange={(e) => setForm({ ...form, quota: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Event (kosong = semua)</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" value={form.eventId}
                onChange={(e) => setForm({ ...form, eventId: e.target.value })}>
                <option value="">Semua Event</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Berlaku Dari</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" type="date" value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Berlaku Sampai</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" type="date" value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn ghost text-xs" onClick={() => setFormOpen(false)}>Batal</button>
              <button className="btn text-xs" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-sm p-4" onClick={() => setHistoryFor(null)}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black uppercase tracking-tight">Riwayat {historyFor.code}</h2>
            <div className="text-sm text-gray-500">Terpakai {historyFor.usedCount} kali</div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="py-2">Nama</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Diskon</th>
                    <th className="py-2">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-400">Belum ada pemakaian</td></tr>
                  ) : redemptions.map(r => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 font-bold">{r.name}</td>
                      <td className="py-2 text-gray-500">{r.email}</td>
                      <td className="py-2">Rp {r.discountAmount.toLocaleString('id-ID')}</td>
                      <td className="py-2 text-gray-500">{new Date(r.createdAt).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button className="btn ghost text-xs" onClick={() => setHistoryFor(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `src/App.tsx`**

Add import near `PaymentsPage` (line ~82):

```ts
const VouchersPage = lazyReload(() => import("./components/admin/pages/VouchersPage"));
```

Inside the admin layout routes (after `<Route path="payments" element={<PaymentsPage />} />`, line ~190):

```tsx
              <Route path="vouchers" element={<VouchersPage />} />
```

- [ ] **Step 3: Add sidebar item in `src/components/admin/AppSidebar.tsx`**

Copy the Payments item shape (lines ~159-162) and insert right after it:

```ts
  {
    label: 'Vouchers',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 01.83 3.806L8.83 8.806A1.99 1.99 0 018 9H3m4 8v3m0-3H3m4 0h.01M13 21v-3m0 3h-2m2 0h4a2 2 0 002-2V5a2 2 0 00-2-2h-6.5a1 1 0 00-.7.3l-8 8a1 1 0 000 1.4l5.8 5.8a1 1 0 00.7.3H13z" /></svg>,
    path: '/admin/vouchers',
  },
```

(Match the surrounding item style — if items there use `{ label, icon, path }` with an extra `children`/role field, mirror Payments exactly.)

- [ ] **Step 4: Verify in browser**

Log in as an admin, open `/admin/vouchers`: create a voucher, see it listed, edit quota, toggle inactive, open Riwayat (empty), attempt delete on a used voucher → friendly 400 error shown.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/pages/VouchersPage.tsx src/App.tsx src/components/admin/AppSidebar.tsx
git commit -m "feat(voucher): admin vouchers page with usage history"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all order-id + voucher tests PASS.

- [ ] **Step 2: Type-check / build**

```bash
npm run build && npm run build:server
```

Expected: both builds succeed with no TS errors.

- [ ] **Step 3: Full happy path smoke**

Dev stack: create voucher (admin) → checkout with code → Snap shows discounted total → pay (sandbox) → webhook settles → `VoucherRedemption` row exists, `usedCount` incremented, history visible in admin. Re-use the same voucher with the same email → rejected with "Kamu sudah pernah memakai voucher ini".

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(voucher): final verification fixes"
```

(Only if there were fixes; otherwise skip.)
