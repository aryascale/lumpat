import { useState, useEffect } from 'react';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const loadLogs = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/activity-logs?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (page === 1) loadLogs();
    }, 30000);
    return () => clearInterval(interval);
  }, [page]);

  return (
    <div className="flex flex-col">
      <div className="card flex-1 flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="header-row mb-6">
          <div>
            <h2 className="section-title">Activity Logs</h2>
            <div className="subtle">Riwayat aktivitas sistem dan transaksi.</div>
          </div>
          <button className="btn" onClick={loadLogs} disabled={loading}>
            {loading ? 'Memuat...' : 'Refresh'}
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="f1-table compact">
            <thead>
              <tr>
                <th className="font-bold">Waktu</th>
                <th className="font-bold">Aksi</th>
                <th className="font-bold">Pelaku</th>
                <th className="font-bold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty py-20 text-center text-gray-400 font-medium">
                    {loading ? 'Memuat data log...' : 'Belum ada log aktivitas.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="row-hover">
                    <td className="mono text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td>
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-gray-100 text-gray-600 border border-gray-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="font-bold text-sm text-gray-900">{log.actor}</td>
                    <td className="text-xs text-gray-600 leading-relaxed">{log.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> logs
            </div>
            <div className="flex gap-1">
              <button
                className="btn ghost sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <button
                className="btn sm w-10 h-8 p-0 flex items-center justify-center font-bold"
                disabled
              >
                {page}
              </button>
              <button
                className="btn ghost sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
