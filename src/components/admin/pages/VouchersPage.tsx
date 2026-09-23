import { useState, useEffect } from 'react';
import { message, InputNumber } from 'antd';

const idFormat = (v: any) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const idParse = (display: any) => Number(`${display ?? ''}`.replace(/\D/g, '')) || 0;

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
      if (res.ok) {
        setVouchers((await res.json()).vouchers || []);
      } else {
        console.error('[VOUCHERS] Load failed:', res.status);
        message.error(`Gagal memuat voucher (${res.status}${res.status === 401 ? ' — login ulang' : ''})`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch('/api/events?showDrafts=true').then(r=>r.json()).then(data => {
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
      payload.maxDiscount = form.maxDiscount ? Number(form.maxDiscount) : null;
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
    else message.error(`Gagal memuat riwayat (${res.status})`);
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
                {form.discountType === 'percent' ? (
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" type="number" min="1" max="100" value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })} />
                ) : (
                  <InputNumber className="w-full mt-1" min={1} value={form.value ? Number(form.value) : undefined}
                    formatter={idFormat} parser={idParse as any}
                    onChange={(v) => setForm({ ...form, value: v ? String(v) : '' })} />
                )}
              </div>
            </div>
            {form.discountType === 'percent' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Diskon Maksimal (Rp, opsional)</label>
                <InputNumber className="w-full mt-1" min={1} value={form.maxDiscount ? Number(form.maxDiscount) : undefined}
                  formatter={idFormat} parser={idParse as any}
                  onChange={(v) => setForm({ ...form, maxDiscount: v ? String(v) : '' })} />
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
            <h2 className="text-lg font-bold">Riwayat pemakaian {historyFor.code}</h2>
            <p className="text-sm text-gray-500 -mt-3">
              Terpakai {historyFor.usedCount}{historyFor.quota > 0 ? ` dari kuota ${historyFor.quota}` : ' kali'}
            </p>
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
