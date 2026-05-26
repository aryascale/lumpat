import React, { useState } from 'react';
import { Mail, MessageCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Spin } from 'antd';

export default function SupportTicketPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    category: '',
    subject: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successTicket, setSuccessTicket] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim laporan');
      
      setSuccessTicket(data.ticketNumber);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (successTicket) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
        <div className="bg-neutral-800 p-8 rounded-2xl max-w-md w-full text-center border border-neutral-700">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Tiket Berhasil Dibuat</h2>
          <p className="text-neutral-300 mb-6">
            Laporan kendala Anda telah kami terima. Nomor tiket Anda adalah:
          </p>
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-700 text-2xl font-mono text-primary-500 font-bold mb-6 tracking-wider">
            {successTicket}
          </div>
          <p className="text-neutral-400 text-sm mb-8">
            Salinan nomor tiket ini beserta pemberitahuan balasan dari tim kami akan dikirimkan ke email Anda: <br />
            <span className="text-white font-medium">{formData.email}</span>
          </p>
          
          <div className="flex gap-4 justify-center">
            <a 
              href="/" 
              className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full font-medium transition-colors"
            >
              Kembali ke Beranda
            </a>
            <a 
              href="/cek-tiket" 
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full font-medium transition-colors"
            >
              Cek Tiket
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-neutral-800 rounded-3xl overflow-hidden border border-neutral-700 shadow-2xl">
        <div className="px-6 py-8 border-b border-neutral-700 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Bantuan & Lapor Kendala</h1>
          <p className="text-neutral-400">Silakan isi formulir di bawah ini untuk melaporkan kendala yang Anda alami saat mendaftar.</p>
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
                <label className="block text-sm font-medium text-neutral-300 mb-2">Nama Lengkap *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  placeholder="Nama Anda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  placeholder="Email aktif"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">No. WhatsApp</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  placeholder="0812..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Kategori Kendala *</label>
                <select
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all appearance-none"
                >
                  <option value="">Pilih Kategori</option>
                  <option value="pembayaran">Pembayaran Gagal / Pending</option>
                  <option value="salah_data">Salah Input Data</option>
                  <option value="sulit_daftar">Kesulitan Mendaftar</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Subjek *</label>
              <input
                type="text"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                placeholder="Topik singkat kendala Anda"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Deskripsi Lengkap *</label>
              <textarea
                name="description"
                required
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Ceritakan detail kendala yang Anda alami..."
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Spin size="small" /> : <Mail className="w-5 h-5" />}
              <span>{loading ? 'Mengirim...' : 'Kirim Laporan'}</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-neutral-400 text-sm">
              Butuh bantuan mendesak?
            </p>
            <a 
              href="https://wa.me/6281234567890" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-green-400 hover:text-green-300 font-medium bg-green-900/20 px-4 py-2 rounded-full border border-green-500/30 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Hubungi WA Official</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
