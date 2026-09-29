import { useState, useEffect, useCallback } from 'react';
import type { Dayjs } from 'dayjs';
import { Select, Table, Input, DatePicker, Button, Progress, Alert } from 'antd';
import { SendOutlined, ExperimentOutlined, ReloadOutlined } from '@ant-design/icons';

interface Candidate {
  id: string;
  name: string;
  email: string;
  categoryName: string;
  createdAt: string;
}

interface BlastRow {
  id: string;
  eventName: string;
  subject: string;
  createdAt: string;
  sentCount: number;
  pendingCount: number;
  failedCount: number;
}

interface SendProgress {
  sent: number;
  pending: number;
  failed: number;
  stopped: string;
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export default function EmailBlastPage() {
  // Step 1 — audience
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventId, setEventId] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [before, setBefore] = useState<Dayjs | null>(null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Step 2 — compose
  const [subject, setSubject] = useState('');
  const [badge, setBadge] = useState('INFO');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [testing, setTesting] = useState(false);
  const [creating, setCreating] = useState(false);

  // Step 3 — send progress
  const [activeBlast, setActiveBlast] = useState<{ blastId: string; total: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress | null>(null);

  const [error, setError] = useState('');
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [history, setHistory] = useState<BlastRow[]>([]);

  const loadQuota = useCallback(() => {
    fetch('/api/admin-email-quota').then(r => r.json()).then(setQuota).catch(() => {});
  }, []);

  const loadHistory = useCallback(() => {
    fetch('/api/admin-email-blast').then(r => r.json())
      .then(d => setHistory(d.blasts || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadQuota();
    loadHistory();
    fetch('/api/events?showDrafts=true').then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : [];
      setEvents(list.map((e: any) => ({ id: e.id, name: e.name })));
      if (list.length > 0) setEventId(list[0].id);
    }).catch(() => {});
  }, [loadQuota, loadHistory]);

  useEffect(() => {
    if (!eventId) return;
    setCategory('');
    fetch(`/api/categories?eventId=${eventId}`).then(r => r.json()).then(data => {
      setCategories((data.categories || []).map((c: any) => (typeof c === 'string' ? c : c.name)));
    }).catch(() => setCategories([]));
  }, [eventId]);

  // Fetch candidates (search debounced)
  useEffect(() => {
    if (!eventId) return;
    const t = setTimeout(async () => {
      setLoadingCandidates(true);
      try {
        const params = new URLSearchParams({ eventId });
        if (category) params.set('category', category);
        if (before) params.set('before', before.format('YYYY-MM-DD'));
        if (search.trim()) params.set('q', search.trim());
        const res = await fetch(`/api/admin-email-blast?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const list: Candidate[] = data.candidates || [];
          setCandidates(list);
          setSelected(list.map(c => c.id));
        }
      } catch {
        setError('Gagal memuat daftar peserta');
      } finally {
        setLoadingCandidates(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [eventId, category, before, search]);

  const sendLoop = async (blastId: string, initialSent: number, initialPending: number, initialFailed: number) => {
    setSending(true);
    setError('');
    setProgress({ sent: initialSent, pending: initialPending, failed: initialFailed, stopped: '' });
    try {
      for (let guard = 0; guard < 500; guard++) {
        const res = await fetch('/api/admin-email-blast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', blastId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengirim');
        setProgress({ sent: data.sent, pending: data.pending, failed: data.failed, stopped: data.stopped });
        if (data.stopped !== 'batch') break;
      }
    } catch (e: any) {
      setError(e.message || 'Gagal mengirim');
    } finally {
      setSending(false);
      loadQuota();
      loadHistory();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    try {
      const res = await fetch('/api/admin-email-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', eventId, subject, badge, title, message, linkUrl, linkLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim test');
      setProgress(null);
      setError('');
      alert(`Email test terkirim ke ${data.to}. Cek inbox Anda (dan folder spam).`);
    } catch (e: any) {
      setError(e.message || 'Gagal mengirim test');
    } finally {
      setTesting(false);
      loadQuota();
    }
  };

  const handleCreate = async () => {
    if (!window.confirm(`Kirim email ke ${selected.length} penerima?`)) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin-email-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', eventId, subject, badge, title, message, linkUrl, linkLabel, recipientIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat blast');
      setActiveBlast({ blastId: data.blastId, total: data.recipientCount });
      await sendLoop(data.blastId, 0, data.recipientCount, 0);
    } catch (e: any) {
      setError(e.message || 'Gagal membuat blast');
    } finally {
      setCreating(false);
    }
  };

  const resumeBlast = (row: BlastRow) => {
    setActiveBlast({ blastId: row.id, total: row.sentCount + row.pendingCount + row.failedCount });
    sendLoop(row.id, row.sentCount, row.pendingCount, row.failedCount);
  };

  const canCompose = subject.trim() && message.trim() && selected.length > 0 && !sending && !creating;

  const candidateColumns = [
    { title: 'Nama', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Kategori', dataIndex: 'categoryName', key: 'categoryName' },
    { title: 'Tgl Daftar', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => fmtDate(v) },
  ];

  const historyColumns = [
    { title: 'Tanggal', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => fmtDate(v) },
    { title: 'Event', dataIndex: 'eventName', key: 'eventName' },
    { title: 'Subject', dataIndex: 'subject', key: 'subject' },
    { title: 'Terkirim', dataIndex: 'sentCount', key: 'sentCount', render: (v: number) => <span className="font-semibold text-green-600">{v}</span> },
    { title: 'Pending', dataIndex: 'pendingCount', key: 'pendingCount', render: (v: number) => <span className={v > 0 ? 'font-semibold text-amber-600' : 'text-gray-400'}>{v}</span> },
    { title: 'Gagal', dataIndex: 'failedCount', key: 'failedCount', render: (v: number) => <span className={v > 0 ? 'font-semibold text-red-600' : 'text-gray-400'}>{v}</span> },
    {
      title: '', key: 'action',
      render: (_: any, row: BlastRow) => (
        <Button size="small" disabled={row.pendingCount === 0 || sending} onClick={() => resumeBlast(row)}>
          Lanjutkan
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-2xl font-black tracking-tight text-gray-900 uppercase">Email Blast</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Kirim email massal ke peserta per event — BAST, pengumuman, info refund, dll.</p>
        </div>
        {quota && (
          <div className={`rounded-full px-3 py-1.5 border text-xs font-semibold ${quota.remaining <= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
            Kuota SMTP 24 jam: {quota.used}/{quota.limit}
          </div>
        )}
      </div>

      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} />}

      {/* Step 1 — Audience */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-gray-900 mb-4">1. Pilih Penerima</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Select
            placeholder="Pilih event"
            value={eventId || undefined}
            onChange={setEventId}
            options={events.map(e => ({ value: e.id, label: e.name }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="Kategori (semua)"
            value={category || undefined}
            onChange={setCategory}
            allowClear
            options={categories.map(c => ({ value: c, label: c }))}
          />
          <DatePicker
            placeholder="Daftar sebelum tanggal"
            value={before}
            onChange={setBefore}
            allowClear
            className="w-full"
          />
          <Input placeholder="Cari nama / email" value={search} onChange={e => setSearch(e.target.value)} allowClear />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs text-gray-500">
            {candidates.length} peserta lunas · <span className="font-semibold text-gray-900">{selected.length} dipilih</span>
          </p>
          <div className="flex gap-2">
            <Button size="small" onClick={() => setSelected(candidates.map(c => c.id))}>Pilih semua</Button>
            <Button size="small" onClick={() => setSelected([])}>Hapus seleksi</Button>
          </div>
        </div>
        <Table
          size="small"
          rowKey="id"
          columns={candidateColumns}
          dataSource={candidates}
          loading={loadingCandidates}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as string[]),
          }}
          locale={{ emptyText: eventId ? 'Tidak ada peserta sesuai filter' : 'Pilih event dulu' }}
        />
      </div>

      {/* Step 2 — Compose */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-gray-900 mb-4">2. Tulis Email</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="flex gap-3">
            <div className="w-28 shrink-0">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Badge</label>
              <Input value={badge} onChange={e => setBadge(e.target.value)} placeholder="INFO" maxLength={16} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Subject *</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Contoh: Upload Hasil Lari — BAST Virtual Run" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Judul di email</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kosongkan = sama dengan subject" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Pesan *</label>
            <Input.TextArea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              placeholder={'Halo [nama],\n\nSilakan upload hasil lari kamu untuk event [event] kategori [kategori]...'}
            />
            <p className="text-[11px] text-gray-400 mt-1">Placeholder: [nama] · [event] · [kategori] — baris baru dipisah jadi paragraf</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Link tombol (opsional)</label>
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Label tombol</label>
            <Input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Kosongkan = default" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <Button icon={<ExperimentOutlined />} onClick={handleTest} loading={testing} disabled={!subject.trim() || !message.trim()}>
            Kirim Test ke Email Saya
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleCreate}
            loading={creating || sending}
            disabled={!canCompose}
            className="!bg-stone-950"
          >
            {sending ? 'Mengirim...' : `Kirim ke ${selected.length} Penerima`}
          </Button>
        </div>
      </div>

      {/* Step 3 — Progress */}
      {progress && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
          <h2 className="text-sm font-black uppercase tracking-wide text-gray-900 mb-4">3. Pengiriman {activeBlast ? `(${activeBlast.blastId.slice(0, 8)}…)` : ''}</h2>
          <Progress
            percent={Math.round((progress.sent / Math.max(1, progress.sent + progress.pending + progress.failed)) * 100)}
            status={progress.pending > 0 ? 'active' : progress.failed > 0 ? 'exception' : 'success'}
          />
          <div className="flex flex-wrap gap-4 text-sm mt-3">
            <span className="text-green-600 font-semibold">{progress.sent} terkirim</span>
            <span className={progress.pending > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'}>{progress.pending} pending</span>
            <span className={progress.failed > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>{progress.failed} gagal</span>
          </div>
          {progress.stopped === 'quota' && progress.pending > 0 && (
            <Alert
              className="mt-3"
              type="warning"
              showIcon
              message="Kuota SMTP 24 jam mentok"
              description={`Sisa buffer dipakai untuk OTP & email tiket. ${progress.pending} penerima pending — kembali ke halaman ini besok lalu klik "Lanjutkan Kirim" (atau dari Riwayat).`}
            />
          )}
          {progress.pending > 0 && !sending && (
            <Button className="mt-3" icon={<ReloadOutlined />} onClick={() => activeBlast && sendLoop(activeBlast.blastId, progress.sent, progress.pending, progress.failed)}>
              Lanjutkan Kirim
            </Button>
          )}
          {progress.pending === 0 && !sending && (
            <Alert className="mt-3" type={progress.failed > 0 ? 'warning' : 'success'} showIcon
              message={progress.failed > 0 ? `Selesai, tapi ${progress.failed} gagal terkirim — cek log server / coba blast ulang.` : 'Selesai — semua penerima sudah terkirim.'} />
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-gray-900 mb-4">Riwayat Blast</h2>
        <Table
          size="small"
          rowKey="id"
          columns={historyColumns}
          dataSource={history}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          locale={{ emptyText: 'Belum ada blast' }}
        />
      </div>
    </div>
  );
}
