import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminInput, AdminNumberInput, AdminSelect, ChipToggle, Field } from '../ui';

interface Voucher {
  id: string;
  code: string;
  discountType: 'nominal' | 'percent';
  value: number;
  maxDiscount: number | null;
  minPurchase: number | null;
  categoryIds: string[] | null;
  quota: number;
  eventId: string | null;
  validFrom: string | null;
  validUntil: string | null;
}

const emptyForm = {
  code: '',
  discountType: 'nominal' as 'nominal' | 'percent',
  value: '',
  maxDiscount: '',
  minPurchase: '',
  quota: '0',
  eventId: '',
  categoryIds: [] as string[],
  validFrom: '',
  validUntil: '',
};

export default function VoucherFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = !!id;
  const [form, setForm] = useState({ ...emptyForm });
  const [events, setEvents] = useState<{id:string;name:string}[]>([]);
  const [catOptions, setCatOptions] = useState<{id:string;name:string}[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/events?showDrafts=true').then(r=>r.json()).then(data => {
      const list = Array.isArray(data) ? data : [];
      setEvents(list.map((e:any)=>({id:e.id,name:e.name})));
    }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch('/api/admin-vouchers').then(r => r.json()).then(d => {
      const v: Voucher | undefined = (d.vouchers || []).find((x: any) => x.id === id);
      if (!v) { alert('Voucher tidak ditemukan'); navigate('/admin/vouchers'); return; }
      setForm({
        code: v.code,
        discountType: v.discountType,
        value: String(v.value),
        maxDiscount: v.maxDiscount ? String(v.maxDiscount) : '',
        minPurchase: v.minPurchase ? String(v.minPurchase) : '',
        quota: String(v.quota),
        eventId: v.eventId || '',
        categoryIds: v.categoryIds || [],
        validFrom: v.validFrom ? v.validFrom.slice(0, 10) : '',
        validUntil: v.validUntil ? v.validUntil.slice(0, 10) : '',
      });
      setLoading(false);
    }).catch(() => { alert('Gagal memuat voucher'); navigate('/admin/vouchers'); });
  }, [id]);

  useEffect(() => {
    if (!form.eventId) { setCatOptions([]); return; }
    fetch(`/api/categories?eventId=${form.eventId}`).then(r => r.json()).then(d =>
      setCatOptions(((d.categories || []) as any[]).map(c => ({ id: c.id, name: c.name })))
    ).catch(() => {});
  }, [form.eventId]);

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
      payload.minPurchase = form.minPurchase ? Number(form.minPurchase) : null;
      // Category restriction requires an event scope; empty list = all categories
      payload.categoryIds = form.eventId ? form.categoryIds : [];
      const res = editing
        ? await fetch('/api/admin-vouchers', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, ...payload }) })
        : await fetch('/api/admin-vouchers', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ code: form.code, ...payload }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menyimpan'); return; }
      navigate('/admin/vouchers');
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? (form.code ? `Edit ${form.code}` : 'Edit Voucher') : 'Voucher Baru';

  return (
    <div className="flex flex-col">
      <div className="header-row mb-4 md:mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button className="btn ghost whitespace-nowrap" onClick={() => navigate('/admin/vouchers')}>← Kembali</button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-black tracking-tight text-gray-900 uppercase truncate">{title}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {editing ? 'Ubah detail voucher, lalu simpan.' : 'Buat kode voucher beserta aturannya.'}
            </p>
          </div>
        </div>
      </div>

      <div className="card !p-4 md:!p-6 max-w-2xl w-full">
        {loading ? (
          <div className="text-center py-24 text-gray-400 font-medium">Loading voucher...</div>
        ) : (
          <div className="space-y-4">
            <Field label="Kode">
              <AdminInput className="font-black uppercase tracking-wider" value={form.code} disabled={editing}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EARLYBIRD" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tipe">
                <AdminSelect value={form.discountType} disabled={editing}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}>
                  <option value="nominal">Nominal (Rp)</option>
                  <option value="percent">Persen (%)</option>
                </AdminSelect>
              </Field>
              <Field label={form.discountType === 'percent' ? 'Nilai (%)' : 'Nominal'}>
                {form.discountType === 'percent' ? (
                  <AdminInput type="number" min={1} max={100} value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })} />
                ) : (
                  <AdminNumberInput prefix="Rp" min={1} placeholder="0" value={form.value ? Number(form.value) : null}
                    onChange={(v) => setForm({ ...form, value: v != null ? String(v) : '' })} />
                )}
              </Field>
            </div>
            {form.discountType === 'percent' && (
              <Field label="Diskon Maksimal (opsional)">
                <AdminNumberInput prefix="Rp" min={1} placeholder="0" value={form.maxDiscount ? Number(form.maxDiscount) : null}
                  onChange={(v) => setForm({ ...form, maxDiscount: v != null ? String(v) : '' })} />
              </Field>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Kuota" hint="0 = unlimited">
                <AdminInput type="number" min={0} value={form.quota}
                  onChange={(e) => setForm({ ...form, quota: e.target.value })} />
              </Field>
              <Field label="Min. Belanja (opsional)">
                <AdminNumberInput prefix="Rp" min={0} placeholder="0" value={form.minPurchase ? Number(form.minPurchase) : null}
                  onChange={(v) => setForm({ ...form, minPurchase: v != null ? String(v) : '' })} />
              </Field>
            </div>
            <Field label="Event (kosong = semua)">
              <AdminSelect value={form.eventId}
                onChange={(e) => setForm({ ...form, eventId: e.target.value, categoryIds: [] })}>
                <option value="">Semua Event</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </AdminSelect>
            </Field>
            {form.eventId && (
              <Field label="Berlaku untuk Kategori (kosong = semua)">
                {catOptions.length === 0 ? (
                  <p className="text-xs text-gray-400">Tidak ada kategori di event ini</p>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-gray-400">
                        {form.categoryIds.length > 0 ? `${form.categoryIds.length} dari ${catOptions.length} dipilih` : 'Semua kategori'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button type="button" className="text-[10px] font-bold uppercase tracking-wider text-stone-600 hover:underline"
                          onClick={() => setForm({ ...form, categoryIds: catOptions.map(c => c.id) })}>Pilih semua</button>
                        <span className="text-gray-300">·</span>
                        <button type="button" className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:underline"
                          onClick={() => setForm({ ...form, categoryIds: [] })}>Kosongkan</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {catOptions.map(c => (
                        <ChipToggle key={c.id} active={form.categoryIds.includes(c.id)}
                          onClick={() => setForm({ ...form, categoryIds: form.categoryIds.includes(c.id) ? form.categoryIds.filter(cid => cid !== c.id) : [...form.categoryIds, c.id] })}>
                          {c.name}
                        </ChipToggle>
                      ))}
                    </div>
                  </>
                )}
              </Field>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Berlaku Dari">
                <AdminInput type="date" value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
              </Field>
              <Field label="Berlaku Sampai">
                <AdminInput type="date" value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button className="btn ghost text-xs" onClick={() => navigate('/admin/vouchers')}>Batal</button>
              <button className="btn text-xs" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
