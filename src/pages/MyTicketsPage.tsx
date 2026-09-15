import React, { useState } from 'react';
import { Search, AlertCircle, Ticket, Download, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

interface MyTicket {
  id: string;
  name: string;
  bibNumber: string | null;
  bibName: string | null;
  tshirtSize: string | null;
  orderId: string | null;
  paidAt: string;
  eventName: string;
  eventDate: string;
  location: string | null;
  categoryName: string;
}

async function downloadTicketPdf(t: MyTicket) {
  const qrData = await QRCode.toDataURL(`${window.location.origin}/verify/${t.id}`, { width: 240, margin: 2 });
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, 90, 'F');
  pdf.setTextColor(255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text(String(t.eventName).slice(0, 42), W / 2, 45, { align: 'center' });
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`E-TICKET • Order ${t.orderId || '-'}`, W / 2, 65, { align: 'center' });

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text(t.name, 40, 150);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  pdf.text(`${t.categoryName}${t.bibNumber ? ` • BIB ${t.bibNumber}` : ''}`, 40, 172);

  const rows: Array<[string, string]> = [
    ['Tanggal', t.eventDate ? new Date(t.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
    ['Lokasi', t.location || '-'],
    ['Ukuran kaos', t.tshirtSize || '-'],
    ['Nama di BIB', t.bibName || '-'],
  ];
  let y = 220;
  for (const [k, v] of rows) {
    pdf.setTextColor(148, 163, 184);
    pdf.text(k, 40, y);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(v).slice(0, 60), 180, y);
    pdf.setFont('helvetica', 'normal');
    y += 26;
  }

  pdf.addImage(qrData, 'PNG', W / 2 - 70, y + 10, 140, 140);
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Tunjukkan QR ini saat race pack collection', W / 2, y + 170, { align: 'center' });

  pdf.save(`tiket-${t.orderId || t.id}.pdf`);
}

export default function MyTicketsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTickets(null);
    try {
      const params = new URLSearchParams({ email });
      if (name.trim()) params.set('name', name.trim());
      const res = await fetch(`/api/my-tickets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat tiket');
      setTickets(data.tickets || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (t: MyTicket) => {
    setDownloadingId(t.id);
    try {
      await downloadTicketPdf(t);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Search Card */}
        <div className="bg-neutral-800 rounded-3xl overflow-hidden border border-neutral-700 shadow-2xl">
          <div className="px-6 py-8 border-b border-neutral-700 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Download E-Ticket</h1>
            <p className="text-neutral-400">Masukkan nama dan email yang dipakai saat mendaftar.</p>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Nama Lengkap</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="Nama sesuai pendaftaran"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Email <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="email@contoh.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                <span>Cari Tiket</span>
              </button>
            </form>
          </div>
        </div>

        {/* Results */}
        {tickets && tickets.length === 0 && (
          <div className="bg-neutral-800 rounded-3xl border border-neutral-700 p-8 text-center text-neutral-400">
            Tiket tidak ditemukan. Pastikan nama &amp; email sesuai dan pembayaran sudah lunas.
          </div>
        )}

        {tickets && tickets.length > 0 && (
          <div className="space-y-6">
            {tickets.map((t) => (
              <div key={t.id} className="bg-neutral-800 rounded-3xl overflow-hidden border border-neutral-700 shadow-2xl">
                <div className="px-6 py-5 bg-neutral-900/60 border-b border-dashed border-neutral-700 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold text-white">{t.eventName}</h2>
                    <p className="text-sm text-neutral-400 mt-1">
                      {t.eventDate ? new Date(t.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                      {t.location ? ` • ${t.location}` : ''}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-900/50 text-emerald-400 border border-emerald-700/50 rounded-full text-xs font-medium flex items-center gap-2">
                    <Ticket className="w-3.5 h-3.5" /> Lunas
                  </span>
                </div>

                <div className="p-6 sm:p-8">
                  <p className="text-2xl font-bold text-white">{t.name}</p>
                  <p className="text-sm text-neutral-400 mt-1">
                    {t.categoryName}
                    {t.bibNumber ? ` • BIB ${t.bibNumber}` : ''}
                    {t.tshirtSize ? ` • ${t.tshirtSize}` : ''}
                  </p>
                  <p className="text-xs text-neutral-500 mt-2">Order {t.orderId || '-'}</p>

                  <button
                    onClick={() => handleDownload(t)}
                    disabled={downloadingId === t.id}
                    className="mt-6 w-full sm:w-auto bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {downloadingId === t.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
