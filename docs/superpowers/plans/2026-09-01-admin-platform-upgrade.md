# Admin Platform Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden admin RBAC, surface monitoring, add RPC participant verification with scan logging, downloadable e-ticket PDFs, a support-ticket report, and migrate admin UI to daisyUI (wave 1).

**Architecture:** Vite SPA + Express (`server.ts` maps `/api/a/b` → `api/a-b.ts`), raw SQL via `src/lib/db.ts` `query()`, JWT cookie auth (`src/lib/jwt.ts` `requireRole`), antd admin UI migrating to daisyUI 5 on Tailwind v4.

**Tech Stack:** React 18, TS, Express 5, Prisma 7 (schema + runtime `src/lib/migrations.ts`), Tailwind v4 CSS-first, daisyUI 5, jspdf, qrcode (installed), html5-qrcode (installed).

**Spec:** `docs/superpowers/specs/2026-09-01-admin-platform-upgrade-design.md`

## Global Constraints

- Admin look & operator flow unchanged (owner constraint). `EventDetailPage.tsx` untouched.
- No new test framework (repo has none). Verification = `npm run build` (+ `npm run build:server` when server files change) + curl/manual smoke.
- API style: copy `api/verify-participant.ts` (query + successResponse/errorResponse + CORS_OPTIONS guard). URL mapping: filename dashes = URL slashes.
- Commit per task. Branch: `layoutadmin`.
- Runtime migrations are idempotent (`CREATE TABLE IF NOT EXISTS` / duplicate-column tolerant), pattern in `src/lib/migrations.ts`.

---

### Task 1: Fix RoleGuard + sidebar allowlist + monitoring menu

**Files:**
- Modify: `src/App.tsx:48-62` (RoleGuard)
- Modify: `src/components/admin/AppSidebar.tsx:208-222` (allowlist)

**Interfaces:**
- Produces: `RoleGuard` rejects null users (redirect to `/login-admin`-less flow: unauth → `/admin` shows AdminLayout login screen, so redirect there is fine only if AdminLayout handles unauth — it does after Task 2. For now redirect unauth to `/leaderboard`).

- [ ] **Step 1: RoleGuard — reject null user**

```tsx
function RoleGuard({ children, allowedRoles, redirectTo = "/admin" }: { children: React.ReactNode; allowedRoles: string[]; redirectTo?: string }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to={redirectTo} replace />;

  const role = normalizeUserRole(user.role);
  if (!allowedRoles.includes(role)) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
}
```

- [ ] **Step 2: AppSidebar — monitoring for super_admin, unknown role gets empty menu**

```ts
  const allowedByRole: Record<string, string[]> = {
    super_admin: ['overview', 'events', 'banners', 'payments', 'tickets', 'users', 'activity-logs', 'monitoring'],
    event_admin: ['overview', 'events', 'banners', 'tickets', 'activity-logs'],
    scan_admin: ['tickets', 'activity-logs'],
    payment_admin: ['overview', 'payments', 'activity-logs'],
    user: [],
  };

  const allowed = allowedByRole[normalizedRole] || [];
```

Also change `buildAdminMenuItems(role?: string)` default: `const normalizedRole = normalizeUserRole(role);` (drop `|| 'super_admin'`). And `defaultMenuItems = buildAdminMenuItems('super_admin')` stays explicit.

- [ ] **Step 3: Verify + commit**

Run: `npm run build` → PASS. `git add -A && git commit -m "fix(rbac): RoleGuard rejects unauthenticated users; monitoring menu for super_admin"`

---

### Task 2: AdminLayout JWT login (remove env-credential gate)

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ user, loading, refreshUser, logout }`; `POST /api/auth-login {email, password}` sets HttpOnly cookie (verify exact body shape by reading `api/auth-login.ts` first).

- [ ] **Step 1:** Read `api/auth-login.ts` to confirm request/response shape.
- [ ] **Step 2:** Replace env-credential logic:

```tsx
const { user: authUser, loading: authLoading, refreshUser, logout } = useAuth();
// delete LS_AUTH, ADMIN_USER, ADMIN_PASS, loadAuth, saveAuth, authed/user/pass local state
const [email, setEmail] = useState("");
const [pass, setPass] = useState("");
const [error, setError] = useState("");
const [submitting, setSubmitting] = useState(false);

const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true); setError("");
  try {
    const res = await fetch('/api/auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');
    await refreshUser(); // AuthContext re-hydrates role from /api/auth-me
  } catch (err: any) {
    setError(err.message);
  } finally {
    setSubmitting(false);
  }
};

const handleLogout = async () => {
  await logout();
  navigate('/leaderboard');
};
```

Gate: `if (authLoading) return <PageLoader-ish spinner/>; if (!authUser || activeRole === 'user') return <login screen>;` — keep the existing login-screen JSX, wire inputs to email/pass and button `disabled={submitting}`. Remove `activeRole` fallback `|| 'super_admin'` → `normalizeUserRole(authUser?.role)`. Header dropdown Logout → `handleLogout`. Show `authUser.email` instead of literal "Admin" in header.
- [ ] **Step 3:** `npm run build` → PASS. Manual: `/admin` unauth → login screen; seeded admin login → layout renders.
- [ ] **Step 4:** Commit `feat(admin): JWT session login replaces env-credential gate`

---

### Task 3: Guard legacy routes + monitoring route

**Files:**
- Modify: `src/App.tsx:82-85`

- [ ] **Step 1:** Wrap the two legacy routes and monitoring:

```tsx
<Route path="/monitoring" element={
  <RoleGuard allowedRoles={["super_admin"]} redirectTo="/admin">
    <MonitoringPage />
  </RoleGuard>
} />
<Route path="/admin/home" element={
  <RoleGuard allowedRoles={["super_admin", "event_admin"]} redirectTo="/admin">
    <HomePage />
  </RoleGuard>
} />
<Route path="/admin/create-event" element={
  <RoleGuard allowedRoles={["super_admin", "event_admin"]} redirectTo="/admin">
    <CreateEventPage />
  </RoleGuard>
} />
```

- [ ] **Step 2:** `npm run build` → PASS. Commit `fix(rbac): guard legacy admin routes and /monitoring`

---

### Task 4: API auth fixes (verify public, registrations gated, monitoring roles, scan button)

**Files:**
- Modify: `api/verify-participant.ts`
- Modify: `api/registrations.ts`
- Modify: `api/monitoring.ts:58+` (isAdminRequest)
- Modify: `src/pages/EventPage.tsx` (Scan Peserta button — grep `enableRegisteredScan`)
- Modify: `src/pages/monitoring/MonitoringPage.tsx` (drop x-admin-key computation, cookie fetch)

- [ ] **Step 1: verify-participant.ts — public with limited fields**

Remove the `requireRole` block. Split response: public fields always; PII (`email, phoneNumber, bloodType, dateOfBirth, customData`) only when `getRequestUser(event)` returns a user with admin role:

```ts
import { getRequestUser, normalizeUserRole } from '../src/lib/jwt';
// ...
const authUser = getRequestUser(event);
const isStaff = !!authUser && authUser.role !== 'user';
// participant object: include PII fields only if isStaff
```

- [ ] **Step 2: registrations.ts — gate GET**

```ts
import { requireRole } from '../src/lib/jwt';
// GET branch, before query:
const auth = requireRole(event, ['super_admin', 'event_admin', 'scan_admin', 'payment_admin']);
if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);
```

- [ ] **Step 3: monitoring.ts — requireRole for cookie path**

In `isAdminRequest`: replace literal `admin` role check with `normalizeUserRole(decoded.role)` in `['super_admin','event_admin','scan_admin','payment_admin']`. Keep x-admin-key path (it still works for the old credential).
- [ ] **Step 4: MonitoringPage.tsx — cookie fetch**

Grep `x-admin-key` / `sha256`; replace key computation with plain `fetch(url, { credentials: 'include' })` and drop the `imr_admin_authed` localStorage gate (route is RoleGuard-ed now).
- [ ] **Step 5: EventPage.tsx — role-gate Scan Peserta**

Grep `enableRegisteredScan` and `Scan Peserta`. Wrap button render with `const { user } = useAuth(); const isAdmin = user && normalizeUserRole(user.role) !== 'user';` → render button only if `isAdmin && event.content.enableRegisteredScan !== false`. If EventPage lacks useAuth import, add it.
- [ ] **Step 6:** `npm run build && npm run build:server` → PASS. Curl: `/api/verify-participant?id=x` anon → 200 limited; `/api/registrations?eventId=y` anon → 401. Commit `fix(api): public limited verify, gate registrations, monitoring role check, role-gated scan button`

---

### Task 5: daisyUI foundation + admin primitives

**Files:**
- Modify: `package.json` (devDeps: `daisyui@^5`)
- Modify: `src/styles.css` (top, after lightswind plugin)
- Create: `src/components/admin/ui/index.tsx` (primitives)

- [ ] **Step 1:** `npm i -D daisyui@5`
- [ ] **Step 2:** In `src/styles.css` after `@plugin 'lightswind/plugin';` add:

```css
@plugin "daisyui" {
  themes: lumpat --default;
}
@plugin "daisyui/theme" {
  name: "lumpat";
  default: false;
  prefersdark: false;
  color-scheme: light;
  --color-base-100: #ffffff;
  --color-base-200: #f0f2f5;
  --color-base-300: #e5e7eb;
  --color-base-content: #0f172a;
  --color-primary: #7c3aed;
  --color-primary-content: #ffffff;
  --color-secondary: #64748b;
  --color-secondary-content: #ffffff;
  --color-accent: #FF383C;
  --color-accent-content: #ffffff;
  --color-neutral: #0f172a;
  --color-neutral-content: #ffffff;
  --color-info: #3b82f6;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --radius-selector: 0.5rem;
  --radius-field: 0.5rem;
  --radius-box: 0.75rem;
}
```

(Colors match current admin: antd layout bg `#f0f2f5`, purple `#7c3aed` login button, brand red `#FF383C`.)
- [ ] **Step 3:** Create `src/components/admin/ui/index.tsx` — thin wrappers, no antd:

```tsx
import { cn } from '../../../lib/utils'; // check existing cn helper (lightswind uses one); else local: clsx + twMerge
import type { ReactNode } from 'react';

export function AdminCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>{children}</div>;
}
export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'success' | 'warning' | 'error' }) {
  const toneCls = { default: 'text-gray-900', success: 'text-emerald-600', warning: 'text-amber-600', error: 'text-red-600' }[tone || 'default'];
  return (
    <AdminCard className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold', toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </AdminCard>
  );
}
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
export function AdminButton({ variant = 'primary', className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const variants = { primary: 'btn btn-primary', ghost: 'btn btn-ghost', danger: 'btn btn-error' };
  return <button className={cn(variants[variant], className)} {...props}>{children}</button>;
}
```

`DataTable` / `Modal` / `FilterBar` get extracted lazily in Task 12/13 from real usage (avoid speculative APIs).
- [ ] **Step 4:** `npm run build` → PASS (visual: nothing changes yet — daisyUI base styles scoped to `.btn` etc. Verify admin pages unaffected; if antd buttons shift, set `daisyui` config `root: :root` stays default and only use component classes explicitly).
- [ ] **Step 5:** Commit `feat(ui): daisyUI 5 with lumpat theme + admin primitives`

---

### Task 6: ScanLog model + rpc-verify API

**Files:**
- Modify: `prisma/schema.prisma` (add model)
- Modify: `src/lib/migrations.ts` (idempotent CREATE TABLE)
- Create: `api/rpc-verify.ts`

- [ ] **Step 1: schema.prisma** (after SupportTicket):

```prisma
model ScanLog {
  id             String   @id @default(uuid())
  registrationId String?
  eventId        String?
  bibNumber      String?
  lookup         String?
  scannedBy      String?
  result         String   @default("valid") // valid | not_found | unpaid | invalid
  source         String   @default("rpc")
  createdAt      DateTime @default(now())

  @@index([registrationId])
  @@index([eventId, createdAt])
}
```

- [ ] **Step 2: migrations.ts** append:

```ts
    // Migration 4: ScanLog table for RPC verification history
    try {
      await query(`CREATE TABLE IF NOT EXISTS ScanLog (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        registrationId VARCHAR(36) NULL,
        eventId VARCHAR(36) NULL,
        bibNumber VARCHAR(64) NULL,
        lookup VARCHAR(255) NULL,
        scannedBy VARCHAR(255) NULL,
        result VARCHAR(32) NOT NULL DEFAULT 'valid',
        source VARCHAR(32) NOT NULL DEFAULT 'rpc',
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX ScanLog_registrationId_idx (registrationId),
        INDEX ScanLog_event_created_idx (eventId, createdAt)
      )`);
      console.log('[MIGRATIONS] ✅ ScanLog table ready');
    } catch (e: any) {
      if (!e.message?.includes('already exists')) throw e;
    }
```

- [ ] **Step 3: api/rpc-verify.ts** (role-gated; accepts `id` (registration id from QR `/verify/<id>`) or `bib` + `eventId`):

```ts
import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'scan_admin', 'event_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const { id, bib, eventId } = event.queryStringParameters || {};
    if (!eventId) return errorResponse('eventId is required', 400);

    const lookup = id ? String(id) : String(bib || '');
    if (!lookup) return errorResponse('id or bib is required', 400);

    const rows: any = await query(
      `SELECT er.id, er.name, er.bibNumber, er.bibName, er.tshirtSize, er.gender, er.paymentStatus, er.paidAt, er.orderId,
              c.name AS categoryName
       FROM EventRegistration er
       JOIN Category c ON er.categoryId = c.id
       WHERE er.eventId = ? AND ${id ? 'er.id = ?' : 'er.bibNumber = ?'} LIMIT 1`,
      [eventId, lookup]
    );

    let result = 'not_found';
    let participant: any = null;
    let previous: any = null;

    if (rows.length > 0) {
      participant = rows[0];
      result = participant.paymentStatus === 'settlement' ? 'valid' : 'unpaid';
      const prev: any = await query(
        'SELECT createdAt, scannedBy, result FROM ScanLog WHERE registrationId = ? ORDER BY createdAt DESC LIMIT 1',
        [participant.id]
      );
      previous = prev[0] || null;
    }

    await query(
      `INSERT INTO ScanLog (id, registrationId, eventId, bibNumber, lookup, scannedBy, result, source)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'rpc')`,
      [participant?.id || null, eventId, participant?.bibNumber || null, lookup, auth.user?.email || null, result]
    );

    return successResponse({
      result, // valid | unpaid | not_found
      participant: participant && {
        name: participant.name, bibNumber: participant.bibNumber, bibName: participant.bibName,
        category: participant.categoryName, gender: participant.gender, tshirtSize: participant.tshirtSize,
        paymentStatus: participant.paymentStatus, orderId: participant.orderId,
      },
      previousScan: previous,
    });
  } catch (error: any) {
    console.error('[RPC-VERIFY] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
```

- [ ] **Step 4:** `npm run build:server` → PASS; start dev server, curl with admin cookie: `GET /api/rpc-verify?bib=101&eventId=<uuid>` → `{"result":"valid",...}`; second call → `previousScan` populated. Commit `feat(rpc): registration verification API with ScanLog`

---

### Task 7: RpcPage registration-scan UI

**Files:**
- Modify: `src/pages/RpcPage.tsx`

- [ ] **Step 1:** In the scanner decode callback (line ~60) and `handleSearch`, first check for registration QR / fallback registration lookup:

```tsx
const handleRegistrationLookup = async (lookupId: string | null, bib: string | null) => {
  if (!eventData?.id) return false;
  const params = new URLSearchParams({ eventId: eventData.id, ...(lookupId ? { id: lookupId } : { bib: bib || '' }) });
  const res = await fetch(`/api/rpc-verify?${params}`, { credentials: 'include' });
  if (!res.ok) return false;
  const data = await res.json();
  setRegScan(data); // new state: { result, participant, previousScan } | null
  return true;
};

// decode callback:
const m = decodedText.match(/\/verify\/([0-9a-fA-F-]{36})/);
if (m) { handleRegistrationLookup(m[1], null); return; }
const p = participants.find(p => p.epc === decodedText || String(p.bib) === decodedText);
if (p) setFoundParticipant(p);
else {
  // try BIB as registration before erroring
  handleRegistrationLookup(null, decodedText).then((handled) => { if (!handled) setScanError('QR Code tidak cocok dengan data peserta.'); });
}
```

In `handleSearch`: after local miss, `const handled = await handleRegistrationLookup(null, q); if (!handled) setSearchErrorMsg('Peserta tidak ditemukan.');`
- [ ] **Step 2:** Add `regScan` state + result card (same visual language as existing card: big name, dashed BIB box, status tiles). Status tile shows: `valid` → emerald "Terdaftar & Lunas" (+ if `previousScan` → amber line `Sudah discan ${timeAgo}`), `unpaid` → amber "Belum Bayar", `not_found` → red "Tidak Terdaftar". Countdown reuses the existing 50s timer: extend its effect to also clear `regScan`.
- [ ] **Step 3:** `npm run build` → PASS. Manual scan test with printed/phone QR. Commit `feat(rpc): registration scan with payment status + duplicate scan indicator`

---

### Task 8: my-tickets API

**Files:**
- Create: `api/my-tickets.ts`

- [ ] **Step 1:**

```ts
import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const email = (event.queryStringParameters?.email || '').trim().toLowerCase();
    const name = (event.queryStringParameters?.name || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse('Email tidak valid', 400);

    const rows: any = await query(
      `SELECT er.id, er.name, er.bibNumber, er.bibName, er.tshirtSize, er.orderId, er.paidAt,
              e.name AS eventName, e.eventDate, e.location, c.name AS categoryName
       FROM EventRegistration er
       JOIN Event e ON er.eventId = e.id
       JOIN Category c ON er.categoryId = c.id
       WHERE LOWER(er.email) = ? AND er.paymentStatus = 'settlement'
         ${name ? 'AND LOWER(er.name) LIKE ?' : ''}
       ORDER BY er.paidAt DESC`,
      name ? [email, `%${name.toLowerCase()}%`] : [email]
    );
    return successResponse({ tickets: rows });
  } catch (error: any) {
    console.error('[MY-TICKETS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
```

- [ ] **Step 2:** `npm run build:server`; curl with a known settlement email → tickets array. Commit `feat(api): public my-tickets lookup (settlement only)`

---

### Task 9: /tiket-saya page + jspdf download

**Files:**
- Modify: `package.json` (deps: `jspdf`)
- Create: `src/pages/MyTicketsPage.tsx`
- Modify: `src/App.tsx` (route)

- [ ] **Step 1:** `npm i jspdf`
- [ ] **Step 2:** Page (form → tickets → download). QR via `qrcode` (installed). Download:

```tsx
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

async function downloadPdf(t: any) {
  const qrData = await QRCode.toDataURL(`${window.location.origin}/verify/${t.id}`, { width: 240, margin: 2 });
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  // header band
  pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, W, 90, 'F');
  pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20);
  pdf.text(String(t.eventName).slice(0, 40), W / 2, 45, { align: 'center' });
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  pdf.text(`E-TICKET • Order ${t.orderId}`, W / 2, 65, { align: 'center' });
  // body
  pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24);
  pdf.text(t.name, 40, 150);
  pdf.setFontSize(12); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100);
  pdf.text(`${t.categoryName}${t.bibNumber ? ` • BIB ${t.bibNumber}` : ''}`, 40, 172);
  const rows: [string, string][] = [
    ['Tanggal', t.eventDate ? new Date(t.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
    ['Lokasi', t.location || '-'],
    ['Ukuran kaos', t.tshirtSize || '-'],
    ['Nama di BIB', t.bibName || '-'],
  ];
  let y = 220;
  for (const [k, v] of rows) {
    pdf.setTextColor(148, 163, 184); pdf.text(k, 40, y);
    pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold'); pdf.text(String(v).slice(0, 60), 180, y);
    pdf.setFont('helvetica', 'normal'); y += 26;
  }
  pdf.addImage(qrData, 'PNG', W / 2 - 70, y + 10, 140, 140);
  pdf.setFontSize(9); pdf.setTextColor(148, 163, 184);
  pdf.text('Tunjukkan QR ini saat race pack collection', W / 2, y + 170, { align: 'center' });
  pdf.save(`tiket-${t.orderId || t.id}.pdf`);
}
```

Page component: stone-100 light theme matching public pages, `useAuth`-free (public), form (nama optional + email required) → GET `/api/my-tickets` → ticket cards mirroring email confirmation content + "Download PDF" button each. Follow `CheckTicketPage.tsx` structure (loading/error/empty states).
- [ ] **Step 3:** Route in `App.tsx`: `const MyTicketsPage = lazy(...)` + `<Route path="/tiket-saya" element={<MyTicketsPage />} />` (public, next to `/cek-tiket`).
- [ ] **Step 4:** `npm run build && npm run build:server` → PASS; manual: search seeded settlement email, download opens valid PDF with QR. Commit `feat(ticket): /tiket-saya e-ticket PDF download (name+email lookup)`

---

### Task 10: Fix /cek-tiket 404

**Files:**
- Modify: `src/pages/CheckTicketPage.tsx:26`

- [ ] **Step 1:** Change `fetch(\`/api/tickets/status?${params}\`)` → `fetch(\`/api/tickets?${params}\`)` (GET handler exists in `api/tickets.ts:107`).
- [ ] **Step 2:** `npm run build` → PASS; manual: `/cek-tiket` with a real ticket number → status card renders. Commit `fix(tickets): /cek-tiket calls existing /api/tickets endpoint`

---

### Task 11: Admin support-ticket report

**Files:**
- Modify: `api/admin-tickets.ts` (add summary endpoint data)
- Modify: `src/components/admin/pages/TicketsPage.tsx`

- [ ] **Step 1:** Read `api/admin-tickets.ts`; extend GET list response with aggregates (single extra query):

```ts
const summary: any = await query(
  `SELECT
     COUNT(*) AS total,
     SUM(status = 'open') AS open,
     SUM(status = 'in_progress') AS in_progress,
     SUM(status = 'resolved') AS resolved,
     SUM(priority = 'high') AS high_priority
   FROM SupportTicket ${eventFilter || dateFilter ? 'WHERE ...' : ''}`
);
```

(Fold the list's existing filters into the WHERE; return `summary: summary[0]`.)
- [ ] **Step 2:** TicketsPage: add summary strip using `StatCard` from `src/components/admin/ui` (Total / Open / In Progress / Resolved / High Priority) + date-range + event filter inputs wired to existing fetch params + "Export CSV" button (client-side, copy the CSV pattern from PaymentsPage — grep `Export CSV` / `Blob` there).
- [ ] **Step 3:** `npm run build && npm run build:server` → PASS; manual: `/admin/tickets` shows cards + filters + CSV downloads. Commit `feat(admin): support ticket report — summary, filters, CSV export`

---

### Task 12: antd → daisyUI: layout + sidebar

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`, `src/components/admin/AppSidebar.tsx`, `src/components/admin/SidebarItem.tsx`

- [ ] **Step 1:** Replace antd `Layout/Header/Content/Sider` with divs + Tailwind/daisyUI classes preserving exact metrics: sidebar fixed w-64 (w-20 collapsed), white bg, `border-r border-gray-200`; header h-14 white sticky `border-b`; content margin-left 256/80, padding 24, bg `#f0f2f5`. Replace antd Button/Dropdown/Avatar/Input with daisyUI (`btn btn-ghost btn-circle`, `dropdown dropdown-end`, `avatar placeholder`, `input input-bordered`) keeping identical visuals (sizes, icons from `@ant-design/icons` stay — they're just SVGs; or swap to lucide equivalents already used elsewhere).
- [ ] **Step 2:** `npm run build` → PASS; manual visual check desktop+mobile: collapse, drawer, header dropdown, role badge. Commit `refactor(admin): layout & sidebar on daisyUI, antd-free`

---

### Task 13: antd → daisyUI: overview, tickets, payments pages

**Files:**
- Modify: `src/components/admin/pages/OverviewPage.tsx`, `TicketsPage.tsx`, `PaymentsPage.tsx`

- [ ] **Step 1:** Per page: swap antd components (`Table` → `overflow-x-auto` + `table table-zebra` w/ existing columns; `Modal` → `dialog modal`; `Select` → `select select-bordered`; `Tag` → `badge`; `message.success` → daisyUI toast or keep inline status text) using `AdminCard/StatCard/PageHeader/AdminButton` primitives. Preserve every existing behavior: filters, manual settle, soft-delete, CSV export, pagination.
- [ ] **Step 2:** After each page: `npm run build` → PASS + manual click-through. Commit per page `refactor(admin): <page> on daisyUI`.
- [ ] **Step 3:** Final sweep: confirm no antd imports remain in these files (`grep -l "antd" src/components/admin/pages/{Overview,Tickets,Payments}Page.tsx` → empty).

---

## Self-Review (done)

- Spec coverage: RBAC (T1-4), daisyUI (T5,12,13), RPC+log (T6-7), e-ticket (T8-9), report (T10-11), monitoring menu (T1,3-4). ✓
- No placeholders; type consistency: `regScan` state used in T7 only; `StatCard` defined T5 used T11; rpc-verify response `{result, participant, previousScan}` matches T7 consumer. ✓
- EventDetailPage untouched. Owner-visible change limited to admin login (spec-approved).
