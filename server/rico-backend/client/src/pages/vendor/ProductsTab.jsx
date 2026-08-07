import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Package, Loader } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const emptyForm = () => ({ name: '', category: '', price: '', keywords: '' });

function toKeywordsArray(text) {
  return text
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

export default function ProductsTab({ authedFetch, activeClaims, activeBusinessId, onChangeBusiness }) {
  const [products, setProducts] = useState(null); // null = loading
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeBusinessId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  async function load() {
    setProducts(null);
    const res = await authedFetch(`/vendor/products?businessId=${activeBusinessId}`);
    if (!res) return;
    const data = await res.json();
    setProducts(data.items || []);
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setPanelOpen(true);
  }

  function openEdit(p) {
    setEditingId(p._id);
    setForm({ name: p.name, category: p.category || '', price: String(p.price), keywords: (p.keywords || []).join(', ') });
    setError('');
    setPanelOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const price = parseFloat(form.price);
    if (!form.name.trim() || Number.isNaN(price) || price < 0) {
      setError('يرجى إدخال اسم وسعر صحيحين.');
      setSaving(false);
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      price,
      keywords: toKeywordsArray(form.keywords),
    };
    const res = editingId
      ? await authedFetch(`/vendor/products/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await authedFetch('/vendor/products', { method: 'POST', body: JSON.stringify({ ...payload, businessId: activeBusinessId }) });
    setSaving(false);
    if (!res || !res.ok) {
      setError('تعذر حفظ المنتج.');
      return;
    }
    setPanelOpen(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return;
    const res = await authedFetch(`/vendor/products/${id}`, { method: 'DELETE' });
    if (res && res.ok) load();
  }

  if (activeClaims.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-3xl p-8 text-center">
        <p className="text-on-surface-variant">لا يوجد نشاط تجاري مُفعّل بعد. اربط نشاطك من تبويب الإعدادات أولاً.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={`space-y-6 transition-all ${panelOpen ? 'pe-[400px]' : ''}`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">المنتجات</h1>
            <p className="text-on-surface-variant mt-1">أضف منتجاتك وأسعارها لتظهر في نتائج البحث.</p>
          </div>
          <div className="flex items-center gap-2">
            {activeClaims.length > 1 && (
              <select
                value={activeBusinessId || ''}
                onChange={(e) => onChangeBusiness(e.target.value)}
                className="bg-surface-container-high border-none rounded-xl py-2.5 px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {activeClaims.map((c) => (
                  <option key={c.placeId} value={c.placeId}>
                    {c.placeName}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> إضافة منتج
            </button>
          </div>
        </div>

        {products === null && <p className="text-on-surface-variant">جاري التحميل...</p>}
        {products && products.length === 0 && (
          <div className="bg-surface-container-lowest rounded-3xl p-8 text-center">
            <Package className="w-8 h-8 mx-auto text-on-surface-variant/40 mb-2" />
            <p className="text-on-surface-variant">لا توجد منتجات بعد.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products?.map((p) => (
            <div key={p._id} className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm group">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold leading-tight">{p.name}</h3>
                  {p.category && <span className="text-xs text-on-surface-variant">{p.category}</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p._id)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-error">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-lg font-extrabold text-primary">{p.finalPrice} ر.س</span>
                {p.finalPrice !== p.price && <span className="text-xs text-on-surface-variant line-through">{p.price} ر.س</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ x: -400 }}
            animate={{ x: 0 }}
            exit={{ x: -400 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 h-screen w-[380px] bg-surface-container-lowest shadow-2xl z-30 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
              <h3 className="font-bold text-lg">{editingId ? 'تعديل المنتج' : 'إضافة منتج'}</h3>
              <button onClick={() => setPanelOpen(false)} className="p-2 bg-transparent text-on-surface hover:bg-surface-container rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-on-surface-variant">اسم المنتج</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-on-surface-variant">الفئة (اختياري)</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-on-surface-variant">السعر (ر.س)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-on-surface-variant">كلمات مفتاحية (اختياري، مفصولة بفاصلة)</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              {error && <p className="text-sm text-error bg-error/5 rounded-xl px-4 py-3">{error}</p>}
            </form>
            <div className="px-6 py-5 border-t border-outline-variant flex gap-3">
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex-1 py-3 rounded-xl border border-outline-variant bg-transparent text-on-surface font-semibold text-sm hover:bg-surface-container"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary text-on-primary py-3 rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                حفظ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
