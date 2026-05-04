import { useState, useEffect } from 'react';

interface Payment {
  id: string;
  orderId: string;
  eventName: string;
  eventId: string;
  categoryName: string;
  name: string;
  email: string;
  phoneNumber: string;
  gender: string;
  tshirtSize: string;
  bibName: string;
  grossAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  paidAt: string;
  createdAt: string;
}

interface Summary {
  total: number;
  paid: number;
  pending: number;
  failed: number;
  totalRevenue: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, paid: 0, pending: 0, failed: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/admin-payments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.registrations || []);
        setSummary(data.summary || { total: 0, paid: 0, pending: 0, failed: 0, totalRevenue: 0 });
      }
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'settlement': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancel': case 'expire': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'settlement': return 'Paid';
      case 'pending': return 'Pending';
      case 'cancel': return 'Cancelled';
      case 'expire': return 'Expired';
      default: return status;
    }
  };

  const filtered = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.orderId.toLowerCase().includes(q) || p.eventName.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="header-row mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola semua transaksi pembayaran event.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Revenue</div>
          <div className="text-2xl font-black text-gray-900">Rp {(summary.totalRevenue || 0).toLocaleString('id-ID')}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-black-600 uppercase tracking-wider mb-1">Paid</div>
          <div className="text-2xl font-black text-black-700">{summary.paid || 0}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-black-600 uppercase tracking-wider mb-1">Pending</div>
          <div className="text-2xl font-black text-black-700">{summary.pending || 0}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-black-600 uppercase tracking-wider mb-1">Failed</div>
          <div className="text-2xl font-black text-black-700">{summary.failed || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="search flex-1"
            placeholder="Cari nama, email, order ID, atau event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="settlement">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancel">Cancelled</option>
            <option value="expire">Expired</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block table-wrap">
              <table className="f1-table compact">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Nama</th>
                    <th>Event</th>
                    <th>Kategori</th>
                    <th style={{ width: 120 }}>Amount</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 100 }}>Metode</th>
                    <th style={{ width: 120 }}>Tanggal</th>
                    <th style={{ width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="empty">Tidak ada transaksi</td></tr>
                  ) : (
                    filtered.map(p => (
                      <tr key={p.id} className="row-hover">
                        <td className="mono text-xs">{p.orderId}</td>
                        <td>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-gray-400">{p.email}</div>
                        </td>
                        <td className="text-sm">{p.eventName}</td>
                        <td className="text-sm">{p.categoryName}</td>
                        <td className="mono text-right">Rp {p.grossAmount.toLocaleString('id-ID')}</td>
                        <td>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${statusColor(p.paymentStatus)}`}>
                            {statusLabel(p.paymentStatus)}
                          </span>
                        </td>
                        <td className="text-xs text-gray-500">{p.paymentMethod || '-'}</td>
                        <td className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('id-ID')}</td>
                        <td>
                          {p.paymentStatus === 'pending' && (
                            <button 
                              className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase rounded hover:bg-stone-800 transition-colors"
                              onClick={async () => {
                                if (confirm(`Selesaikan pembayaran untuk ${p.name} secara manual?`)) {
                                  try {
                                    const res = await fetch('/api/admin-settle-payment', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ orderId: p.orderId })
                                    });
                                    if (res.ok) {
                                      alert('Pembayaran diselesaikan');
                                      loadPayments();
                                    }
                                  } catch (e) {
                                    alert('Gagal menyelesaikan pembayaran');
                                  }
                                }
                              }}
                            >
                              Settle
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Tidak ada transaksi</div>
              ) : (
                filtered.map(p => (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.email}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(p.paymentStatus)}`}>
                        {statusLabel(p.paymentStatus)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">{p.eventName} - {p.categoryName}</div>
                    <div className="flex justify-between text-sm">
                      <span className="font-mono font-bold">Rp {p.grossAmount.toLocaleString('id-ID')}</span>
                      <span className="text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 font-mono">{p.orderId}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
