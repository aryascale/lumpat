import React, { useState, useEffect } from 'react';
import { Table, Tag, Modal, Button, Select, Input, message } from 'antd';
import { Ticket, Search, Filter, MessageCircle, Mail } from 'lucide-react';
import { useEvent } from '../../../contexts/EventContext';

export default function TicketsPage() {
  const { events } = useEvent();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterStatus !== 'all') query.append('status', filterStatus);
      if (filterEvent !== 'all') query.append('eventId', filterEvent);
      
      const res = await fetch(`/api/admin/tickets?${query.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets || []);
      }
    } catch (err) {
      message.error('Gagal memuat data tiket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterEvent]);

  const handleUpdateStatus = async (status: string, notes?: string) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/tickets?id=${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNotes: notes, resolvedBy: 'Admin' }),
      });
      if (res.ok) {
        message.success('Status tiket berhasil diperbarui');
        setDetailModalOpen(false);
        fetchTickets();
      } else {
        const data = await res.json();
        message.error(data.error || 'Gagal update status');
      }
    } catch (err) {
      message.error('Terjadi kesalahan');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'orange';
      case 'in_progress': return 'blue';
      case 'resolved': return 'green';
      default: return 'default';
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.ticketNumber.toLowerCase().includes(searchText.toLowerCase()) || 
    t.name.toLowerCase().includes(searchText.toLowerCase()) ||
    t.email.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'No Tiket',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      render: (text: string) => <span className="font-mono font-bold">{text}</span>
    },
    {
      title: 'Pelapor',
      key: 'reporter',
      render: (_: any, record: any) => (
        <div>
          <div className="font-medium">{record.name}</div>
          <div className="text-xs text-gray-500">{record.email}</div>
        </div>
      )
    },
    {
      title: 'Event',
      key: 'event',
      render: (_: any, record: any) => record.event?.name || '-'
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => <span className="uppercase text-xs font-bold tracking-wider">{text.replace('_', ' ')}</span>
    },
    {
      title: 'Subjek',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} className="uppercase font-bold">
          {status.replace('_', ' ')}
        </Tag>
      )
    },
    {
      title: 'Tanggal',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => { setSelectedTicket(record); setDetailModalOpen(true); }}>
          Detail
        </Button>
      )
    }
  ];

  const handleWhatsApp = (phone: string) => {
    let formatted = phone.replace(/\D/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  const handleEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank');
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Ticket className="w-6 h-6 text-blue-600" /> Ticketing Kendala
          </h1>
          <p className="text-slate-500">Kelola laporan kendala dari pendaftar</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Input 
            prefix={<Search className="w-4 h-4 text-gray-400" />}
            placeholder="Cari Tiket / Nama..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-48"
          />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            className="w-36"
            options={[
              { value: 'all', label: 'Semua Status' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
          <Select
            value={filterEvent}
            onChange={setFilterEvent}
            className="w-48"
            showSearch
            optionFilterProp="label"
            options={[
              { value: 'all', label: 'Semua Event' },
              ...events.map(e => ({ value: e.id, label: e.name }))
            ]}
          />
          <Button icon={<Filter className="w-4 h-4" />} onClick={fetchTickets}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={filteredTickets} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </div>

      <Modal
        title={
          <div className="flex items-center gap-3">
            <span className="text-lg font-black uppercase">Detail Tiket</span>
            {selectedTicket && <Tag color={getStatusColor(selectedTicket.status)} className="uppercase font-bold">{selectedTicket.status.replace('_', ' ')}</Tag>}
          </div>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedTicket && (
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Nomor Tiket</p>
                <p className="font-mono font-bold text-slate-900">{selectedTicket.ticketNumber}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Event</p>
                <p className="font-medium text-slate-900">{selectedTicket.event?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Nama Pelapor</p>
                <p className="font-medium text-slate-900">{selectedTicket.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Kontak</p>
                <p className="text-sm text-slate-900">{selectedTicket.email}</p>
                {selectedTicket.phoneNumber && <p className="text-sm text-slate-900">{selectedTicket.phoneNumber}</p>}
              </div>
            </div>

            <div className="flex gap-2">
              {selectedTicket.phoneNumber && (
                <Button 
                  type="primary" 
                  className="bg-green-600 hover:bg-green-500" 
                  icon={<MessageCircle className="w-4 h-4" />}
                  onClick={() => handleWhatsApp(selectedTicket.phoneNumber)}
                >
                  Hubungi WhatsApp
                </Button>
              )}
              <Button 
                icon={<Mail className="w-4 h-4" />}
                onClick={() => handleEmail(selectedTicket.email)}
              >
                Kirim Email
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">{selectedTicket.subject}</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap">
                {selectedTicket.description}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Aksi Penyelesaian</h3>
              
              <div className="space-y-4">
                {selectedTicket.status !== 'in_progress' && selectedTicket.status !== 'resolved' && (
                  <Button 
                    onClick={() => handleUpdateStatus('in_progress')} 
                    loading={updating}
                  >
                    Tandai Sedang Diproses (In Progress)
                  </Button>
                )}
                
                {selectedTicket.status !== 'resolved' && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-sm font-medium text-blue-800 mb-2">Tutup Tiket (Resolved)</p>
                    <Input.TextArea 
                      id="resolution-notes"
                      placeholder="Catatan penyelesaian (opsional, akan terlihat oleh pelapor)..."
                      rows={3}
                      className="mb-3"
                    />
                    <Button 
                      type="primary"
                      loading={updating}
                      onClick={() => {
                        const notes = (document.getElementById('resolution-notes') as HTMLTextAreaElement)?.value;
                        handleUpdateStatus('resolved', notes);
                      }}
                    >
                      Selesaikan Tiket
                    </Button>
                  </div>
                )}

                {selectedTicket.status === 'resolved' && (
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                    <p className="text-sm font-bold text-green-800">Tiket telah diselesaikan</p>
                    {selectedTicket.resolutionNotes && (
                      <p className="mt-2 text-sm text-green-900 bg-white p-3 rounded-lg border border-green-100">
                        <strong>Catatan:</strong> {selectedTicket.resolutionNotes}
                      </p>
                    )}
                    <Button 
                      className="mt-3" 
                      size="small"
                      onClick={() => handleUpdateStatus('open')}
                      loading={updating}
                    >
                      Buka Kembali (Reopen)
                    </Button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
}
