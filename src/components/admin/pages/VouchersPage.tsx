import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminModal } from '../ui';

interface Voucher {
  id: string;
  code: string;
  discountType: 'nominal' | 'percent';
  value: number;
  maxDiscount: number | null;
  minPurchase: number | null;
  categoryIds: string[] | null;
  categoryNames?: string[];
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

export default function VouchersPage() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
        alert(`Gagal memuat voucher (${res.status}${res.status === 401 ? ' — sesi habis, login ulang' : res.status === 403 ? ' — role tidak punya akses' : ''})`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
    else alert(`Gagal memuat riwayat (${res.status})`);
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

  const termsLabel = (v: Voucher) => {
    const parts: string[] = [];
    if (v.minPurchase) parts.push(`Min Rp ${v.minPurchase.toLocaleString('id-ID')}`);
    if (v.categoryNames && v.categoryNames.length > 0) parts.push(v.categoryNames.join(', '));
    return parts.length > 0 ? parts.join(' · ') : '—';
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
        <button className="btn ghost whitespace-nowrap text-xs" onClick={() => navigate('/admin/vouchers/new')}>+ Voucher Baru</button>
      </div>

      <div className="card flex-1 flex flex-col mb-4" style={{ minHeight: 'calc(100vh - 400px)' }}>
        {loading ? (
          <div className="text-center py-24 text-gray-400 font-medium">Loading vouchers data...</div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="table-wrap">
              <table className="f1-table compact">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Diskon</th>
                    <th>Syarat</th>
                    <th>Terpakai / Kuota</th>
                    <th>Event</th>
                    <th>Masa Aktif</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 280 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="empty py-20">Belum ada voucher</td></tr>
                  ) : filtered.map(v => (
                    <tr key={v.id} className="row-hover">
                      <td className="mono font-bold">{v.code}</td>
                      <td className="text-xs font-medium">{discountLabel(v)}</td>
                      <td className="text-xs text-gray-500">{termsLabel(v)}</td>
                      <td className="text-xs">{v.usedCount} / {v.quota === 0 ? '∞' : v.quota}</td>
                      <td className="text-xs font-medium">{v.eventName || 'Semua Event'}</td>
                      <td className="text-xs">{validityLabel(v)}</td>
                      <td>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${v.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                          {v.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="flex gap-2">
                        <button className="px-2 py-1 bg-blue-500 text-white text-[10px] font-bold uppercase rounded hover:bg-blue-600 transition-colors" onClick={() => openHistory(v)}>Riwayat</button>
                        <button className="px-2 py-1 bg-stone-600 text-white text-[10px] font-bold uppercase rounded hover:bg-stone-700 transition-colors" onClick={() => navigate(`/admin/vouchers/${v.id}/edit`)}>Edit</button>
                        <button className="px-2 py-1 bg-yellow-500 text-white text-[10px] font-bold uppercase rounded hover:bg-yellow-600 transition-colors" onClick={() => toggleActive(v)}>{v.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        <button className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold uppercase rounded hover:bg-red-600 transition-colors" onClick={() => remove(v)}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {historyFor && (
        <AdminModal wide title={`Riwayat — ${historyFor.code}`} onClose={() => setHistoryFor(null)}
          footer={<button className="btn ghost text-xs" onClick={() => setHistoryFor(null)}>Tutup</button>}>
          <p className="text-sm text-gray-500">
            Terpakai {historyFor.usedCount}{historyFor.quota > 0 ? ` dari kuota ${historyFor.quota}` : ' kali'}
          </p>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-sm">
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
        </AdminModal>
      )}
    </div>
  );
}
