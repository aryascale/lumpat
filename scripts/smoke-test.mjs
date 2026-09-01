/**
 * Smoke test for the admin platform upgrade — runs against a local server
 * seeded by `npm run seed:dev`. No framework, just fetch + assertions.
 *
 * Usage:
 *   npm run dev:full          # in one terminal (server on :3069)
 *   npm run smoke             # in another
 */

const BASE = process.env.SMOKE_BASE || 'http://localhost:3069';
const results = [];
let exitCode = 0;

function check(name, cond, detail = '') {
  const ok = !!cond;
  results.push(ok);
  if (!ok) exitCode = 1;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
}

async function api(path, { cookie, method = 'GET' } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}) },
    credentials: 'include',
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookies = res.headers.getSetCookie?.() || [];
  const token = cookies.find((c) => c.startsWith('token='))?.split(';')[0];
  return { status: res.status, cookie: token || null, body: await res.json().catch(() => null) };
}

async function main() {
  console.log(`\n🔍 Smoke test against ${BASE}\n`);

  // --- 0. Server & seed data -------------------------------------------------
  const ev = await api('/api/events?eventId=lumpat-fun-run-2026');
  check('Server up & event seeded', ev.status === 200 && ev.body?.id, `status=${ev.status}`);
  const eventId = ev.body?.id;

  // --- 1. Auth ----------------------------------------------------------------
  const badLogin = await login('super_admin@lumpat.co.id', 'wrong-password');
  check('Login dengan password salah ditolak (401)', badLogin.status === 401);

  const superA = await login('super_admin@lumpat.co.id', 'Admin123!');
  const scanA = await login('scan_admin@lumpat.co.id', 'Scan123!');
  const payA = await login('payment_admin@lumpat.co.id', 'Payment123!');
  check('Login JWT super_admin', superA.status === 200 && !!superA.cookie);
  check('Login JWT scan_admin', scanA.status === 200 && !!scanA.cookie);
  check('Login JWT payment_admin', payA.status === 200 && !!payA.cookie);

  // --- 2. RBAC pada /api/registrations ----------------------------------------
  const regAnon = await api(`/api/registrations?eventId=${eventId}`);
  check('Registrations anon ditolak (401, PII terlindungi)', regAnon.status === 401, `status=${regAnon.status}`);

  const regAuth = await api(`/api/registrations?eventId=${eventId}`, { cookie: superA.cookie });
  check('Registrations dengan sesi admin (200)', regAuth.status === 200 && regAuth.body?.participants?.length >= 3);

  // --- 3. E-ticket lookup (my-tickets) ----------------------------------------
  const mine = await api('/api/my-tickets?email=budi@example.com&name=budi');
  check('My-tickets: lookup nama+email publik (200)', mine.status === 200);
  check('My-tickets: hanya settlement (Joko pending tidak ikut)', mine.body?.tickets?.length === 1, `got ${mine.body?.tickets?.length}`);
  check('My-tickets: tiket berisi BIB & event', mine.body?.tickets?.[0]?.bibNumber === '1001' && mine.body?.tickets?.[0]?.eventName === 'Lumpat Fun Run 2026');
  const budiRegId = mine.body?.tickets?.[0]?.id;

  // --- 4. Verify publik dengan data terbatas -----------------------------------
  const vAnon = await api(`/api/verify-participant?id=${budiRegId}`);
  check('Verify anon: 200 (QR email bisa discan tanpa login)', vAnon.status === 200 && vAnon.body?.verified === true);
  check('Verify anon: TANPA PII (phoneNumber/email/bloodType tidak dikirim)', vAnon.body?.participant && !('phoneNumber' in vAnon.body.participant) && !('email' in vAnon.body.participant) && !('bloodType' in vAnon.body.participant));

  const vStaff = await api(`/api/verify-participant?id=${budiRegId}`, { cookie: scanA.cookie });
  check('Verify staff: PII lengkap (phoneNumber ada)', vStaff.status === 200 && !!vStaff.body?.participant?.phoneNumber);

  // --- 5. RPC verify + ScanLog --------------------------------------------------
  const rpcAnon = await api(`/api/rpc-verify?bib=1001&eventId=${eventId}`);
  check('RPC verify anon ditolak (401)', rpcAnon.status === 401, `status=${rpcAnon.status}`);

  const rpc1 = await api(`/api/rpc-verify?bib=1001&eventId=${eventId}`, { cookie: scanA.cookie });
  check('RPC verify BIB 1001: valid & lunas', rpc1.body?.result === 'valid' && rpc1.body?.participant?.name === 'Budi Santoso');

  const rpc2 = await api(`/api/rpc-verify?bib=1001&eventId=${eventId}`, { cookie: scanA.cookie });
  check('RPC verify scan kedua: terdeteksi sudah discan (previousScan)', !!rpc2.body?.previousScan?.createdAt);

  const rpcPending = await api(`/api/rpc-verify?id=${await findPendingId(eventId, superA.cookie)}&eventId=${eventId}`, { cookie: scanA.cookie });
  check('RPC verify peserta pending: result "unpaid"', rpcPending.body?.result === 'unpaid');

  const rpc404 = await api(`/api/rpc-verify?bib=9999&eventId=${eventId}`, { cookie: scanA.cookie });
  check('RPC verify BIB tidak ada: result "not_found"', rpc404.body?.result === 'not_found');

  // --- 6. Monitoring & admin endpoints ------------------------------------------
  const mon = await api('/api/monitoring?range=60', { cookie: superA.cookie });
  check('Monitoring API dengan sesi super_admin (200)', mon.status === 200 && !!mon.body?.server);

  const ticketsList = await api('/api/admin/tickets', { cookie: scanA.cookie });
  check('Admin tickets list (scan_admin, 200) — 3 tiket seed', ticketsList.status === 200 && ticketsList.body?.tickets?.length >= 3, `status=${ticketsList.status}`);

  const cekTicket = await api('/api/tickets?email=budi@example.com&ticketNumber=LMPT-202609-DEV1');
  check('Cek status tiket publik (/cek-tiket, 200)', cekTicket.status === 200 && cekTicket.body?.ticket?.status === 'open', `status=${cekTicket.status}`);

  const cekTicketWrong = await api('/api/tickets?email=sari@example.com&ticketNumber=LMPT-202609-DEV1');
  check('Cek status tiket: email tidak cocok (404)', cekTicketWrong.status === 404, `status=${cekTicketWrong.status}`);

  const paymentsList = await api('/api/admin-payments', { cookie: payA.cookie });
  check('Admin payments (payment_admin, 200)', paymentsList.status === 200);

  const usersForbidden = await api('/api/admin-users', { cookie: scanA.cookie });
  check('Admin users untuk scan_admin ditolak (403, super_admin only)', usersForbidden.status === 403, `status=${usersForbidden.status}`);

  // --- Summary -------------------------------------------------------------------
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed ${passed === results.length ? '🎉' : '⚠️'}\n`);
  process.exit(exitCode);
}

async function findPendingId(eventId, cookie) {
  const res = await api(`/api/registrations?eventId=${eventId}`, { cookie });
  return res.body?.participants?.find((p) => p.paymentStatus === 'pending')?.id || '';
}

main().catch((err) => {
  console.error('\n💥 Smoke test crashed:', err.message);
  console.error('Pastikan server jalan (npm run dev:full) dan seed sudah dijalankan (npm run seed:dev).');
  process.exit(1);
});
