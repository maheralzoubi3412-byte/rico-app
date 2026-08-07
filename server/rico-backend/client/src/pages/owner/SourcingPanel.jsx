import { useState, useEffect } from 'react';
import { CATEGORY_LABELS, DEAL_TYPES } from './api';

const emptyBusinessForm = () => ({ name: '', nameAr: '', categorySlug: 'restaurant', lat: '', lng: '', city: '', phone: '' });
const emptyDealForm = () => ({ businessId: '', titleAr: '', dealType: 'percent', value: '' });
const emptySyncForm = () => ({ lat: '', lng: '', categorySlug: 'restaurant', radiusMeters: '2000' });

export default function SourcingPanel({ authedFetch }) {
  const [usage, setUsage] = useState(null);
  const [businessForm, setBusinessForm] = useState(emptyBusinessForm());
  const [businessStatus, setBusinessStatus] = useState(null);
  const [dealForm, setDealForm] = useState(emptyDealForm());
  const [dealStatus, setDealStatus] = useState(null);
  const [syncForm, setSyncForm] = useState(emptySyncForm());
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsage() {
    const res = await authedFetch('/owner/sourcing/usage');
    if (!res) return;
    setUsage(await res.json());
  }

  async function submitBusiness(e) {
    e.preventDefault();
    setBusinessStatus(null);
    const res = await authedFetch('/owner/sourcing/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...businessForm,
        lat: parseFloat(businessForm.lat),
        lng: parseFloat(businessForm.lng),
      }),
    });
    if (res && res.ok) {
      setBusinessStatus({ type: 'success', message: 'تمت إضافة النشاط.' });
      setBusinessForm(emptyBusinessForm());
    } else {
      setBusinessStatus({ type: 'error', message: 'تعذر إضافة النشاط.' });
    }
  }

  async function submitDeal(e) {
    e.preventDefault();
    setDealStatus(null);
    const res = await authedFetch('/owner/sourcing/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dealForm, value: dealForm.value === '' ? undefined : Number(dealForm.value) }),
    });
    if (res && res.ok) {
      setDealStatus({ type: 'success', message: 'تمت إضافة العرض.' });
      setDealForm(emptyDealForm());
    } else {
      setDealStatus({ type: 'error', message: 'تعذر إضافة العرض — تحقق من معرّف النشاط.' });
    }
  }

  async function submitSync(e) {
    e.preventDefault();
    setSyncStatus(null);
    setSyncing(true);
    const res = await authedFetch('/owner/sourcing/sync-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: parseFloat(syncForm.lat),
        lng: parseFloat(syncForm.lng),
        categorySlug: syncForm.categorySlug,
        radiusMeters: Number(syncForm.radiusMeters),
      }),
    });
    setSyncing(false);
    if (res && res.ok) {
      const body = await res.json();
      setSyncStatus({ type: 'success', message: `تمت المزامنة: ${body.created} جديد، ${body.updated} محدَّث.` });
      loadUsage();
    } else {
      const body = res ? await res.json().catch(() => ({})) : {};
      setSyncStatus({ type: 'error', message: body.detail || 'تعذرت المزامنة.' });
    }
  }

  return (
    <div>
      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>مزامنة Google Places</h1>
        {usage && (
          <p className="subtitle">
            الاستخدام هذا الشهر ({usage.googlePlaces.period}): {usage.googlePlaces.count}/{usage.googlePlaces.cap}
            {' · '}المتبقي: {usage.googlePlaces.remaining}
          </p>
        )}
        <form onSubmit={submitSync}>
          <label>خط العرض (lat)</label>
          <input type="number" step="any" required value={syncForm.lat} onChange={(e) => setSyncForm({ ...syncForm, lat: e.target.value })} />
          <label>خط الطول (lng)</label>
          <input type="number" step="any" required value={syncForm.lng} onChange={(e) => setSyncForm({ ...syncForm, lng: e.target.value })} />
          <label>الفئة</label>
          <select value={syncForm.categorySlug} onChange={(e) => setSyncForm({ ...syncForm, categorySlug: e.target.value })}>
            {Object.entries(CATEGORY_LABELS).map(([slug, label]) => (
              <option key={slug} value={slug}>{label}</option>
            ))}
          </select>
          <label>نطاق البحث (متر)</label>
          <input type="number" value={syncForm.radiusMeters} onChange={(e) => setSyncForm({ ...syncForm, radiusMeters: e.target.value })} />
          <button className="full" type="submit" disabled={syncing}>{syncing ? 'جاري المزامنة...' : 'مزامنة'}</button>
          {syncStatus && <div className={`status ${syncStatus.type}`}>{syncStatus.message}</div>}
        </form>
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>إضافة نشاط تجاري يدوياً</h1>
        <form onSubmit={submitBusiness}>
          <label>الاسم</label>
          <input required value={businessForm.name} onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })} />
          <label>الاسم بالعربية (اختياري)</label>
          <input value={businessForm.nameAr} onChange={(e) => setBusinessForm({ ...businessForm, nameAr: e.target.value })} />
          <label>الفئة</label>
          <select value={businessForm.categorySlug} onChange={(e) => setBusinessForm({ ...businessForm, categorySlug: e.target.value })}>
            {Object.entries(CATEGORY_LABELS).map(([slug, label]) => (
              <option key={slug} value={slug}>{label}</option>
            ))}
          </select>
          <label>خط العرض (lat)</label>
          <input type="number" step="any" required value={businessForm.lat} onChange={(e) => setBusinessForm({ ...businessForm, lat: e.target.value })} />
          <label>خط الطول (lng)</label>
          <input type="number" step="any" required value={businessForm.lng} onChange={(e) => setBusinessForm({ ...businessForm, lng: e.target.value })} />
          <label>المدينة (اختياري)</label>
          <input value={businessForm.city} onChange={(e) => setBusinessForm({ ...businessForm, city: e.target.value })} />
          <label>الهاتف (اختياري)</label>
          <input value={businessForm.phone} onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })} />
          <button className="full" type="submit">إضافة</button>
          {businessStatus && <div className={`status ${businessStatus.type}`}>{businessStatus.message}</div>}
        </form>
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>إضافة عرض يدوياً</h1>
        <form onSubmit={submitDeal}>
          <label>معرّف النشاط (businessId)</label>
          <input required value={dealForm.businessId} onChange={(e) => setDealForm({ ...dealForm, businessId: e.target.value })} />
          <label>عنوان العرض</label>
          <input required maxLength={120} value={dealForm.titleAr} onChange={(e) => setDealForm({ ...dealForm, titleAr: e.target.value })} />
          <label>نوع العرض</label>
          <select value={dealForm.dealType} onChange={(e) => setDealForm({ ...dealForm, dealType: e.target.value })}>
            {DEAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label>القيمة (اختياري)</label>
          <input type="number" value={dealForm.value} onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} />
          <button className="full" type="submit">إضافة</button>
          {dealStatus && <div className={`status ${dealStatus.type}`}>{dealStatus.message}</div>}
        </form>
      </div>
    </div>
  );
}
