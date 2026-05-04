import { useState, useEffect } from 'react';
import { useEvent } from '../../../contexts/EventContext';

export default function ActivityLogsPage() {
  const { currentEvent } = useEvent();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const loadLogs = async () => {
    try {
      setLoading(true);
      // Show all logs if no specific event is selected or if 'default' is selected
      const eventIdParam = currentEvent?.id && currentEvent.id !== 'default' && currentEvent.id !== 'all' ? `&eventId=${currentEvent.id}` : '';
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/activity-logs?limit=${limit}&offset=${offset}${eventIdParam}`);
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
  }, [currentEvent?.id, page]);

  return (
    <div className="card">
      <div className="header-row mb-6">
        <div>
          <h2 className="section-title">Activity Logs</h2>
          <div className="subtle">Riwayat aktivitas sistem dan transaksi.</div>
        </div>
        <button className="btn" onClick={loadLogs} disabled={loading}>
          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-600">
              <th className="py-3 px-4 font-semibold">Waktu</th>
              <th className="py-3 px-4 font-semibold">Aksi</th>
              <th className="py-3 px-4 font-semibold">Pelaku</th>
              <th className="py-3 px-4 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  })}
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-gray-100 text-gray-700">
                    {log.action}
                  </span>
                </td>
                <td className="py-3 px-4 font-medium text-gray-900">{log.actor}</td>
                <td className="py-3 px-4 text-gray-600">{log.detail}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  Belum ada log aktivitas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total} log
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </button>
            <button
              className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50"
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= total}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
