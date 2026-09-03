import { useState, useEffect } from 'react';
import { CATEGORY_LABELS, DEAL_TYPES, errorMessage } from './api';

// لوحة المفاتيح العربية تُدخل الفاصل العشري كـ"٫" (U+066B) أو "," وحقل
// type="number" يرفضهما بصمت، فتصل "35.886" كـ"35886" — وهذا بالضبط ما حوّل
// خط طول 35.8862959 إلى 358862959 ورفضته Mongo عند الكتابة برد 500 غامض.
// نطبّع الأرقام العربية-الهندية والفواصل العشرية قبل التحليل، ثم نفحص المدى.
const ARABIC_INDIC_ZERO = 0x0660;

function normalizeNumeric(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[\u066B,\u060C]/g, '.')
    .replace(/\u066C/g, ''); // فاصل الآلاف العربي
}

function parseCoordinate(raw, { min, max }) {
  const text = normalizeNumeric(raw);
  // Number('') === 0، وصفر إحداثية صالحة تماماً — فلو مرّرنا الفراغ لـNumber
  // لصار الحقل الفارغ نشاطاً على خط الاستواء بدل رسالة خطأ.
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

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

    const lat = parseCoordinate(businessForm.lat, { min: -90, max: 90 });
    const lng = parseCoordinate(businessForm.lng, { min: -180, max: 180 });
    if (lat === null || lng === null) {
      setBusinessStatus({
        type: 'error',
        message: 'الإحداثيات غير صحيحة — خط العرض بين -90 و90، وخط الطول بين -180 و180 (مثال: 24.7136 و46.6753).',
      });
      return;
    }

    const res = await authedFetch('/owner/sourcing/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...businessForm, lat, lng }),
    });
    if (res && res.ok) {
      setBusinessStatus({ type: 'success', message: 'تمت إضافة النشاط.' });
      setBusinessForm(emptyBusinessForm());
    } else {
      setBusinessStatus({ type: 'error', message: await errorMessage(res, 'تعذر إضافة النشاط.') });
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
          <input type="text" inputMode="decimal" required placeholder="24.7136" value={businessForm.lat} onChange={(e) => setBusinessForm({ ...businessForm, lat: e.target.value })} />
          <label>خط الطول (lng)</label>
          <input type="text" inputMode="decimal" required placeholder="46.6753" value={businessForm.lng} onChange={(e) => setBusinessForm({ ...businessForm, lng: e.target.value })} />
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
