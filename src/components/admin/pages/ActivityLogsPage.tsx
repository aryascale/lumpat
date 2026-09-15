import { useState, useEffect } from 'react';
import { Modal, Input, Spin } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showErrorOnly, setShowErrorOnly] = useState(false);
  const limit = 50;

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/activity-logs?limit=${limit}&offset=${offset}&category=${category}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } else {
        setError(`Gagal memuat logs (${res.status}): ${res.statusText}`);
        setLogs([]);
        setTotal(0);
      }
    } catch (err: any) {
      setError(`Error memuat logs: ${err.message}`);
      setLogs([]);
      setTotal(0);
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
  }, [page, category]);

  const isError = (action: string) => action.includes('ERROR') || action.includes('FAIL');
  
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = search === '' || 
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.detail?.toLowerCase().includes(search.toLowerCase()) ||
      log.actor?.toLowerCase().includes(search.toLowerCase());
    
    const matchesErrorFilter = !showErrorOnly || isError(log.action);
    
    return matchesSearch && matchesErrorFilter;
  });

  const errorCount = logs.filter(log => isError(log.action)).length;

  return (
    <div className="flex flex-col h-full">
      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error Memuat Activity Logs</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 flex-shrink-0"
          >
            <CloseOutlined />
          </button>
        </div>
      )}

      <div className="card flex-1 flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="header-row mb-6">
          <div>
            <h2 className="section-title">Activity Logs</h2>
            <div className="subtle">Riwayat aktivitas sistem dan transaksi</div>
            {errorCount > 0 && (
              <div className="mt-2 text-sm">
                <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs">
                  {errorCount} ERROR / FAIL
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input.Search
              placeholder="Cari action, detail, user..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="sm:w-60"
              allowClear
            />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="search text-sm"
            >
              <option value="ALL">Semua Log</option>
              <option value="ERROR">Errors & Fails</option>
              <option value="AUTH">Authentication</option>
              <option value="PAYMENT">Payments</option>
              <option value="ADMIN">Admin Actions</option>
              <option value="SYSTEM">System/Webhooks</option>
              <option value="USER">User Actions</option>
            </select>
            <button
              onClick={() => setShowErrorOnly(!showErrorOnly)}
              className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                showErrorOnly
                  ? 'bg-red-100 text-red-700 border-red-300'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
            >
              Errors Only
            </button>
            <button className="btn" onClick={loadLogs} disabled={loading}>
              {loading ? <Spin size="small" /> : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Desktop Table - hidden on mobile */}
        <div className="hidden md:block flex-1 overflow-auto">
          <table className="f1-table compact">
            <thead>
              <tr>
                <th className="font-bold">Waktu</th>
                <th className="font-bold">Status</th>
                <th className="font-bold">Aksi</th>
                <th className="font-bold">User</th>
                <th className="font-bold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty py-20 text-center text-gray-400 font-medium">
                    {loading ? <Spin /> : (search || showErrorOnly ? 'Tidak ada hasil yang cocok' : 'Belum ada log aktivitas')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const hasError = isError(log.action);
                  return (
                  <tr
                    key={log.id}
                    className={`row-hover cursor-pointer ${hasError ? 'bg-red-50/50 hover:bg-red-100/50' : ''}`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="mono text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td>
                      <span className={`inline-block w-2 h-2 rounded-full ${hasError ? 'bg-red-500' : 'bg-green-500'}`} />
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border whitespace-nowrap ${
                        hasError 
                          ? 'bg-red-100 text-red-700 border-red-300' 
                          : 'bg-blue-100 text-blue-700 border-blue-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="font-medium text-sm text-gray-900">{log.actor || 'System'}</td>
                    <td className={`text-xs leading-relaxed truncate ${hasError ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {log.detail}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards - visible only on mobile */}
        <div className="md:hidden flex-1 overflow-auto space-y-3 pb-4">
          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-gray-400 font-medium text-sm">
              {loading ? <Spin /> : (search || showErrorOnly ? 'Tidak ada hasil yang cocok' : 'Belum ada log')}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const hasError = isError(log.action);
              return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`bg-white border p-3 rounded-lg shadow-sm cursor-pointer transition-colors ${
                  hasError
                    ? 'border-red-200 bg-red-50/50 hover:bg-red-100/50'
                    : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-bold text-sm text-gray-900">{log.actor || 'System'}</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {new Date(log.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[8px] font-black uppercase rounded border whitespace-nowrap ml-2 ${
                    hasError
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-blue-100 text-blue-700 border-blue-300'
                  }`}>
                    {log.action}
                  </span>
                </div>
                <div className={`text-xs p-2 rounded ${hasError ? 'bg-red-50 text-red-700 font-medium' : 'bg-gray-50 text-gray-600'}`}>
                  {log.detail}
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-auto pt-4 border-t border-gray-100 gap-3">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredLogs.length === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-semibold">{total}</span> logs
            </div>
            <div className="flex gap-2">
              <button
                className="btn ghost sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </button>
              <div className="px-3 py-1 rounded border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 flex items-center">
                {page}
              </div>
              <button
                className="btn ghost sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total || loading}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        title={selectedLog ? `Activity Detail - ${selectedLog.action}` : ''}
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={600}
      >
        {selectedLog && (
          <div className="space-y-4">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Status</label>
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  isError(selectedLog.action)
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {isError(selectedLog.action) ? 'ERROR / FAIL' : 'SUCCESS'}
                </span>
              </div>
            </div>

            {/* Action */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Action</label>
              <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm">
                {selectedLog.action}
              </div>
            </div>

            {/* User */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">User / Actor</label>
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                {selectedLog.actor || 'System'}
              </div>
            </div>

            {/* Detail */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Detail / Message</label>
              <div className={`p-3 rounded border ${
                isError(selectedLog.action)
                  ? 'bg-red-50 border-red-200 text-red-700 font-medium'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                {selectedLog.detail || '-'}
              </div>
            </div>

            {/* Event ID */}
            {selectedLog.eventId && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Event ID</label>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-xs break-all">
                  {selectedLog.eventId}
                </div>
              </div>
            )}

            {/* Metadata */}
            {selectedLog.metadata && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Metadata</label>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-xs max-h-48 overflow-auto">
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Timestamp</label>
              <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
                {new Date(selectedLog.createdAt).toLocaleString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZoneName: 'short'
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
